#!/usr/bin/env node

const axios = require("axios");
const { program } = require("commander");
const chalk = require("chalk");
const Table = require("cli-table3");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Configuration file path
const configPath = path.join(os.homedir(), ".uptime-kuma-cli.json");

// Load configuration
function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, "utf8"));
        }
    } catch (error) {
        console.error(chalk.red("Error loading config:"), error.message);
    }
    return {};
}

// Save configuration
function saveConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(chalk.green("Configuration saved"));
    } catch (error) {
        console.error(chalk.red("Error saving config:"), error.message);
    }
}

// Create axios instance with auth
function createClient(config) {
    const baseURL = config.url || "http://localhost:3001";
    const auth = config.auth || {};
    
    return axios.create({
        baseURL: `${baseURL}/api/v2`,
        auth: {
            username: auth.username || "admin",
            password: auth.password || ""
        },
        timeout: 10000
    });
}

// Format status
function formatStatus(status) {
    switch (status) {
        case 0:
            return chalk.red("● DOWN");
        case 1:
            return chalk.green("● UP");
        case 2:
            return chalk.yellow("● PENDING");
        case 3:
            return chalk.blue("● MAINTENANCE");
        default:
            return chalk.gray("● UNKNOWN");
    }
}

// Setup configuration
program
    .command("config")
    .description("Configure Uptime Kuma connection")
    .option("-u, --url <url>", "Uptime Kuma URL", "http://localhost:3001")
    .option("-U, --username <username>", "Username", "admin")
    .option("-p, --password <password>", "Password or API key")
    .action((options) => {
        const config = {
            url: options.url,
            auth: {
                username: options.username,
                password: options.password
            }
        };
        saveConfig(config);
    });

// List monitors
program
    .command("list")
    .alias("ls")
    .description("List all monitors")
    .option("-j, --json", "Output as JSON")
    .action(async (options) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            
            const response = await client.get("/monitors");
            const monitors = response.data;
            
            if (options.json) {
                console.log(JSON.stringify(monitors, null, 2));
            } else {
                const table = new Table({
                    head: ["ID", "Name", "Type", "URL/Host", "Status", "Uptime", "Response"],
                    colWidths: [5, 25, 10, 40, 15, 10, 10]
                });
                
                monitors.forEach(monitor => {
                    const heartbeat = monitor.latestHeartbeat || {};
                    table.push([
                        monitor.id,
                        monitor.name,
                        monitor.type,
                        monitor.url || monitor.hostname || "-",
                        formatStatus(heartbeat.status),
                        heartbeat.uptime ? `${heartbeat.uptime}%` : "-",
                        heartbeat.ping ? `${heartbeat.ping}ms` : "-"
                    ]);
                });
                
                console.log(table.toString());
            }
        } catch (error) {
            console.error(chalk.red("Error:"), error.response?.data?.error || error.message);
            process.exit(1);
        }
    });

// Add monitor
program
    .command("add <name> <url>")
    .description("Add a new monitor")
    .option("-t, --type <type>", "Monitor type", "http")
    .option("-i, --interval <seconds>", "Check interval in seconds", "60")
    .option("-m, --method <method>", "HTTP method", "GET")
    .option("-k, --keyword <keyword>", "Keyword to check")
    .option("-r, --retries <count>", "Number of retries", "0")
    .option("--headers <headers>", "HTTP headers as JSON string")
    .action(async (name, url, options) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            
            const monitorData = {
                name,
                url,
                type: options.type,
                interval: parseInt(options.interval),
                method: options.method,
                maxretries: parseInt(options.retries),
                active: 1
            };
            
            if (options.keyword) {
                monitorData.keyword = options.keyword;
                monitorData.type = "keyword";
            }
            
            if (options.headers) {
                try {
                    monitorData.headers = JSON.parse(options.headers);
                } catch (e) {
                    console.error(chalk.red("Invalid JSON for headers"));
                    process.exit(1);
                }
            }
            
            const response = await client.post("/monitors", monitorData);
            console.log(chalk.green("✓ Monitor added successfully"));
            console.log(`ID: ${response.data.id}`);
            console.log(`Name: ${response.data.name}`);
            console.log(`URL: ${response.data.url}`);
        } catch (error) {
            console.error(chalk.red("Error:"), error.response?.data?.error || error.message);
            process.exit(1);
        }
    });

// Delete monitor
program
    .command("delete <id>")
    .alias("rm")
    .description("Delete a monitor")
    .option("-f, --force", "Skip confirmation")
    .action(async (id, options) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            
            if (!options.force) {
                console.log(chalk.yellow("This will permanently delete the monitor and all its data."));
                console.log(chalk.yellow("Use -f or --force to skip this confirmation."));
                process.exit(0);
            }
            
            await client.delete(`/monitors/${id}`);
            console.log(chalk.green("✓ Monitor deleted successfully"));
        } catch (error) {
            console.error(chalk.red("Error:"), error.response?.data?.error || error.message);
            process.exit(1);
        }
    });

// Pause monitor
program
    .command("pause <id>")
    .description("Pause a monitor")
    .action(async (id) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            
            await client.post(`/monitors/${id}/pause`);
            console.log(chalk.green("✓ Monitor paused"));
        } catch (error) {
            console.error(chalk.red("Error:"), error.response?.data?.error || error.message);
            process.exit(1);
        }
    });

// Resume monitor
program
    .command("resume <id>")
    .description("Resume a monitor")
    .action(async (id) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            
            await client.post(`/monitors/${id}/resume`);
            console.log(chalk.green("✓ Monitor resumed"));
        } catch (error) {
            console.error(chalk.red("Error:"), error.response?.data?.error || error.message);
            process.exit(1);
        }
    });

// Get monitor details
program
    .command("get <id>")
    .description("Get monitor details")
    .option("-j, --json", "Output as JSON")
    .action(async (id, options) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            
            const response = await client.get(`/monitors/${id}`);
            const monitor = response.data;
            
            if (options.json) {
                console.log(JSON.stringify(monitor, null, 2));
            } else {
                console.log(chalk.bold("\nMonitor Details:"));
                console.log(`ID: ${monitor.id}`);
                console.log(`Name: ${monitor.name}`);
                console.log(`Type: ${monitor.type}`);
                console.log(`URL: ${monitor.url || monitor.hostname || "-"}`);
                console.log(`Interval: ${monitor.interval}s`);
                console.log(`Active: ${monitor.active ? chalk.green("Yes") : chalk.red("No")}`);
                
                if (monitor.latestHeartbeat) {
                    const hb = monitor.latestHeartbeat;
                    console.log(chalk.bold("\nLatest Status:"));
                    console.log(`Status: ${formatStatus(hb.status)}`);
                    console.log(`Message: ${hb.msg || "-"}`);
                    console.log(`Response Time: ${hb.ping ? `${hb.ping}ms` : "-"}`);
                    console.log(`Time: ${new Date(hb.time).toLocaleString()}`);
                }
            }
        } catch (error) {
            console.error(chalk.red("Error:"), error.response?.data?.error || error.message);
            process.exit(1);
        }
    });

// Quick add commands for common monitor types
program
    .command("add-http <name> <url>")
    .description("Quick add HTTP monitor")
    .option("-i, --interval <seconds>", "Check interval", "60")
    .action(async (name, url, options) => {
        await program.commands.find(cmd => cmd._name === "add")
            .parseAsync([name, url, "-t", "http", "-i", options.interval], { from: "user" });
    });

program
    .command("add-ping <name> <hostname>")
    .description("Quick add Ping monitor")
    .option("-i, --interval <seconds>", "Check interval", "60")
    .action(async (name, hostname, options) => {
        await program.commands.find(cmd => cmd._name === "add")
            .parseAsync([name, hostname, "-t", "ping", "-i", options.interval], { from: "user" });
    });

program
    .command("add-tcp <name> <hostname> <port>")
    .description("Quick add TCP port monitor")
    .option("-i, --interval <seconds>", "Check interval", "60")
    .action(async (name, hostname, port, options) => {
        const url = `${hostname}:${port}`;
        await program.commands.find(cmd => cmd._name === "add")
            .parseAsync([name, url, "-t", "tcp", "-i", options.interval], { from: "user" });
    });

// Bulk import from file
program
    .command("import <file>")
    .description("Import monitors from JSON file")
    .action(async (file) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            
            const data = JSON.parse(fs.readFileSync(file, "utf8"));
            const monitors = Array.isArray(data) ? data : [data];
            
            console.log(`Importing ${monitors.length} monitor(s)...`);
            
            let success = 0;
            let failed = 0;
            
            for (const monitor of monitors) {
                try {
                    await client.post("/monitors", monitor);
                    console.log(chalk.green(`✓ ${monitor.name}`));
                    success++;
                } catch (error) {
                    console.log(chalk.red(`✗ ${monitor.name}: ${error.response?.data?.error || error.message}`));
                    failed++;
                }
            }
            
            console.log(`\nImport complete: ${success} succeeded, ${failed} failed`);
        } catch (error) {
            console.error(chalk.red("Error:"), error.message);
            process.exit(1);
        }
    });

// Export monitors
program
    .command("export [file]")
    .description("Export monitors to JSON file")
    .action(async (file) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            
            const response = await client.get("/monitors");
            const monitors = response.data.map(m => {
                // Remove server-specific fields
                delete m.id;
                delete m.user_id;
                delete m.latestHeartbeat;
                return m;
            });
            
            const output = JSON.stringify(monitors, null, 2);
            
            if (file) {
                fs.writeFileSync(file, output);
                console.log(chalk.green(`✓ Exported ${monitors.length} monitors to ${file}`));
            } else {
                console.log(output);
            }
        } catch (error) {
            console.error(chalk.red("Error:"), error.response?.data?.error || error.message);
            process.exit(1);
        }
    });

program
    .name("uptime-kuma")
    .description("CLI for Uptime Kuma API")
    .version("1.0.0");

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}