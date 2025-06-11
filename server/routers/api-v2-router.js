let express = require("express");
const { apiAuth } = require("../auth");
const { checkLogin } = require("../util-server");
const { R } = require("redbean-node");
const Monitor = require("../model/monitor");
const User = require("../model/user");
const StatusPage = require("../model/status_page");
const Maintenance = require("../model/maintenance");
const Tag = require("../model/tag");
const { log } = require("../../src/util");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const dayjs = require("dayjs");
const { UP, DOWN, PENDING, MAINTENANCE } = require("../../src/util");

let router = express.Router();
const server = UptimeKumaServer.getInstance();

// Middleware to ensure user is authenticated via API
router.use(apiAuth);

// Helper function to get user from request
async function getUserFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    
    const [type, credentials] = authHeader.split(' ');
    if (type !== 'Basic') return null;
    
    const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
    const [username] = decoded.split(':');
    
    return await R.findOne("user", " username = ? AND active = 1 ", [username]);
}

// ===== MONITORS =====

// GET /api/v2/monitors - List all monitors
router.get("/monitors", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const monitors = await R.find("monitor", " user_id = ? ORDER BY weight DESC, name ASC ", [user.id]);
        
        // Add latest heartbeat to each monitor
        const monitorsWithHeartbeat = await Promise.all(monitors.map(async (monitor) => {
            const heartbeat = await Monitor.getPreviousHeartbeat(monitor.id);
            return {
                ...monitor.toJSON(),
                latestHeartbeat: heartbeat ? heartbeat.toJSON() : null
            };
        }));

        res.json(monitorsWithHeartbeat);
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /api/v2/monitors/:id - Get specific monitor
router.get("/monitors/:id", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const monitor = await R.findOne("monitor", " id = ? AND user_id = ? ", [
            req.params.id,
            user.id
        ]);

        if (!monitor) {
            return res.status(404).json({ error: "Monitor not found" });
        }

        const heartbeat = await Monitor.getPreviousHeartbeat(monitor.id);
        const monitorData = {
            ...monitor.toJSON(),
            latestHeartbeat: heartbeat ? heartbeat.toJSON() : null
        };

        res.json(monitorData);
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/v2/monitors - Create new monitor
router.post("/monitors", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const monitor = new Monitor();
        const data = { ...req.body };
        
        // Set default values
        data.user_id = user.id;
        if (!data.interval) data.interval = 60;
        if (!data.retryInterval) data.retryInterval = 60;
        if (!data.maxretries) data.maxretries = 0;
        if (!data.weight) data.weight = 2000;
        if (!data.active) data.active = 1;
        if (!data.authMethod) data.authMethod = null;

        // Validate required fields
        if (!data.name || !data.type || !data.url) {
            return res.status(400).json({ error: "Missing required fields: name, type, url" });
        }

        Object.assign(monitor, data);
        await R.store(monitor);

        // Start monitoring if active
        if (monitor.active) {
            await monitor.start(server.io);
        }

        res.status(201).json(monitor.toJSON());
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT /api/v2/monitors/:id - Update monitor
router.put("/monitors/:id", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const monitor = await R.findOne("monitor", " id = ? AND user_id = ? ", [
            req.params.id,
            user.id
        ]);

        if (!monitor) {
            return res.status(404).json({ error: "Monitor not found" });
        }

        const wasActive = monitor.active;
        const data = { ...req.body };
        
        // Prevent changing user_id
        delete data.user_id;
        delete data.id;

        Object.assign(monitor, data);
        await R.store(monitor);

        // Handle monitor start/stop based on active status
        if (wasActive && !monitor.active) {
            monitor.stop();
        } else if (!wasActive && monitor.active) {
            await monitor.start(server.io);
        } else if (monitor.active) {
            monitor.stop();
            await monitor.start(server.io);
        }

        res.json(monitor.toJSON());
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// DELETE /api/v2/monitors/:id - Delete monitor
router.delete("/monitors/:id", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const monitor = await R.findOne("monitor", " id = ? AND user_id = ? ", [
            req.params.id,
            user.id
        ]);

        if (!monitor) {
            return res.status(404).json({ error: "Monitor not found" });
        }

        // Stop monitoring if active
        if (monitor.active) {
            monitor.stop();
        }

        // Delete monitor and related data
        await monitor.delete();

        res.json({ message: "Monitor deleted successfully" });
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/v2/monitors/:id/pause - Pause monitor
router.post("/monitors/:id/pause", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const monitor = await R.findOne("monitor", " id = ? AND user_id = ? ", [
            req.params.id,
            user.id
        ]);

        if (!monitor) {
            return res.status(404).json({ error: "Monitor not found" });
        }

        if (monitor.active) {
            monitor.active = 0;
            await R.store(monitor);
            monitor.stop();
        }

        res.json({ message: "Monitor paused successfully", active: monitor.active });
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/v2/monitors/:id/resume - Resume monitor
router.post("/monitors/:id/resume", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const monitor = await R.findOne("monitor", " id = ? AND user_id = ? ", [
            req.params.id,
            user.id
        ]);

        if (!monitor) {
            return res.status(404).json({ error: "Monitor not found" });
        }

        if (!monitor.active) {
            monitor.active = 1;
            await R.store(monitor);
            await monitor.start(server.io);
        }

        res.json({ message: "Monitor resumed successfully", active: monitor.active });
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /api/v2/monitors/:id/heartbeats - Get monitor heartbeats
router.get("/monitors/:id/heartbeats", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const monitor = await R.findOne("monitor", " id = ? AND user_id = ? ", [
            req.params.id,
            user.id
        ]);

        if (!monitor) {
            return res.status(404).json({ error: "Monitor not found" });
        }

        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;

        const heartbeats = await R.find("heartbeat", 
            " monitor_id = ? ORDER BY time DESC LIMIT ? OFFSET ? ", 
            [monitor.id, limit, offset]
        );

        res.json(heartbeats.map(hb => hb.toJSON()));
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ===== STATUS PAGES =====

// GET /api/v2/status-pages - List all status pages
router.get("/status-pages", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const statusPages = await R.find("status_page", " user_id = ? ORDER BY title ASC ", [user.id]);
        res.json(statusPages.map(sp => sp.toJSON()));
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /api/v2/status-pages/:slug - Get specific status page
router.get("/status-pages/:slug", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const statusPage = await R.findOne("status_page", " slug = ? AND user_id = ? ", [
            req.params.slug,
            user.id
        ]);

        if (!statusPage) {
            return res.status(404).json({ error: "Status page not found" });
        }

        // Get associated monitors
        const monitorIds = await R.getCol(
            "SELECT monitor_id FROM status_page_cname WHERE status_page_id = ?",
            [statusPage.id]
        );

        const monitors = await R.find("monitor", " id IN (" + monitorIds.join(",") + ") ");

        res.json({
            ...statusPage.toJSON(),
            monitors: monitors.map(m => m.toJSON())
        });
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/v2/status-pages - Create status page
router.post("/status-pages", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const data = { ...req.body };
        data.user_id = user.id;

        if (!data.slug || !data.title) {
            return res.status(400).json({ error: "Missing required fields: slug, title" });
        }

        // Check if slug already exists
        const existing = await R.findOne("status_page", " slug = ? ", [data.slug]);
        if (existing) {
            return res.status(409).json({ error: "Slug already exists" });
        }

        const statusPage = R.dispense("status_page");
        Object.assign(statusPage, data);
        await R.store(statusPage);

        res.status(201).json(statusPage.toJSON());
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ===== TAGS =====

// GET /api/v2/tags - List all tags
router.get("/tags", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const tags = await R.find("tag", " user_id = ? ORDER BY name ASC ", [user.id]);
        res.json(tags.map(tag => tag.toJSON()));
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/v2/tags - Create tag
router.post("/tags", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { name, color } = req.body;
        if (!name || !color) {
            return res.status(400).json({ error: "Missing required fields: name, color" });
        }

        const tag = new Tag();
        tag.name = name;
        tag.color = color;
        tag.user_id = user.id;
        await R.store(tag);

        res.status(201).json(tag.toJSON());
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ===== MAINTENANCE =====

// GET /api/v2/maintenance - List all maintenance
router.get("/maintenance", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const maintenances = await R.find("maintenance", " user_id = ? ORDER BY created_date DESC ", [user.id]);
        res.json(maintenances.map(m => m.toJSON()));
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/v2/maintenance - Create maintenance
router.post("/maintenance", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const data = { ...req.body };
        data.user_id = user.id;

        if (!data.title || !data.start_date || !data.end_date) {
            return res.status(400).json({ 
                error: "Missing required fields: title, start_date, end_date" 
            });
        }

        const maintenance = R.dispense("maintenance");
        Object.assign(maintenance, data);
        maintenance.created_date = R.isoDateTimeMillis(dayjs.utc());
        await R.store(maintenance);

        res.status(201).json(maintenance.toJSON());
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ===== SYSTEM INFO =====

// GET /api/v2/info - Get system info
router.get("/info", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const monitorCount = await R.count("monitor", " user_id = ? ", [user.id]);

        res.json({
            version: require("../../package.json").version,
            monitorCount,
            serverTime: dayjs().toISOString()
        });
    } catch (error) {
        log.error("api-v2", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;