#!/usr/bin/env node
// Copyright (c) 2026 Mohammed Aladwani
// Licensed under the MIT License

/**
 * WireGuard Manager - CLI user management tool
 *
 * Usage inside the container:
 *   node /app/scripts/wgm-cli.mjs user list
 *   node /app/scripts/wgm-cli.mjs user create
 *   node /app/scripts/wgm-cli.mjs user passwd <email>
 *   node /app/scripts/wgm-cli.mjs user delete <email>
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import readline from "readline";

const prisma = new PrismaClient();

const ROLES = ["super_admin", "admin", "auditor"];
const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

// -- helpers -------------------------------------------------------------------

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptPassword(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    process.stdout.write(question);
    // Hide input
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    let password = "";
    process.stdin.resume();
    const onData = (char) => {
      char = char.toString();
      if (char === "\n" || char === "\r" || char === "\u0004") {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdout.write("\n");
        process.stdin.removeListener("data", onData);
        process.stdin.pause();
        rl.close();
        resolve(password);
      } else if (char === "\u0003") {
        process.stdout.write("\n");
        process.exit(0);
      } else if (char === "\u007f") {
        password = password.slice(0, -1);
      } else {
        password += char;
      }
    };
    process.stdin.on("data", onData);
  });
}

function printTable(users) {
  if (users.length === 0) {
    console.log("  (no users found)");
    return;
  }
  const col = { name: 20, email: 30, role: 12, created: 12 };
  const header =
    "Name".padEnd(col.name) +
    "Email".padEnd(col.email) +
    "Role".padEnd(col.role) +
    "Created";
  const sep = "-".repeat(header.length + 10);
  console.log("\n" + sep);
  console.log(header);
  console.log(sep);
  for (const u of users) {
    console.log(
      u.name.slice(0, col.name - 1).padEnd(col.name) +
        u.email.slice(0, col.email - 1).padEnd(col.email) +
        u.role.padEnd(col.role) +
        u.createdAt.toISOString().slice(0, 10)
    );
  }
  console.log(sep + "\n");
}

function die(msg) {
  console.error("Error: " + msg);
  process.exit(1);
}

// -- commands ------------------------------------------------------------------

async function cmdList() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  printTable(users);
}

async function cmdCreate() {
  console.log("\n-- Create User ------------------------------\n");

  const name = await prompt("Full name      : ");
  if (name.length < 2) die("Name must be at least 2 characters.");

  const email = await prompt("Email          : ");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) die("Invalid email address.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) die(`User with email "${email}" already exists.`);

  console.log(`\nAvailable roles: ${ROLES.join(", ")}`);
  const role = await prompt("Role           : ");
  if (!ROLES.includes(role)) die(`Invalid role. Must be one of: ${ROLES.join(", ")}`);

  const password = await promptPassword("Password       : ");
  if (password.length < MIN_PASSWORD_LENGTH)
    die(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  const confirm = await promptPassword("Confirm password: ");
  if (password !== confirm) die("Passwords do not match.");

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { name, email, hashedPassword, role },
  });

  console.log(`\n✓ User created: ${user.email} (${user.role})`);
}

async function cmdPasswd(email) {
  if (!email) die("Usage: wgm-cli user passwd <email>");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) die(`No user found with email "${email}".`);

  console.log(`\n-- Reset Password for ${user.email} ----------\n`);

  const password = await promptPassword("New password    : ");
  if (password.length < MIN_PASSWORD_LENGTH)
    die(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  const confirm = await promptPassword("Confirm password: ");
  if (password !== confirm) die("Passwords do not match.");

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { email }, data: { hashedPassword } });

  console.log(`\n✓ Password updated for ${user.email}`);
}

async function cmdDelete(email) {
  if (!email) die("Usage: wgm-cli user delete <email>");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) die(`No user found with email "${email}".`);

  // Prevent deleting the last super_admin
  if (user.role === "super_admin") {
    const adminCount = await prisma.user.count({ where: { role: "super_admin" } });
    if (adminCount <= 1) die("Cannot delete the last super_admin account.");
  }

  console.log(`\nAbout to delete: ${user.name} <${user.email}> (${user.role})`);
  const confirm = await prompt("Type the email to confirm deletion: ");
  if (confirm !== email) die("Email did not match. Deletion cancelled.");

  await prisma.user.delete({ where: { email } });
  console.log(`\n✓ User "${email}" deleted.`);
}

// -- main ----------------------------------------------------------------------

function usage() {
  console.log(`
WireGuard Manager - User Management CLI

  Usage:
    node scripts/wgm-cli.mjs user list
    node scripts/wgm-cli.mjs user create
    node scripts/wgm-cli.mjs user passwd <email>
    node scripts/wgm-cli.mjs user delete <email>

  Examples:
    node scripts/wgm-cli.mjs user list
    node scripts/wgm-cli.mjs user create
    node scripts/wgm-cli.mjs user passwd user@example.com
    node scripts/wgm-cli.mjs user delete john@example.com
`);
  process.exit(1);
}

const [, , resource, command, ...args] = process.argv;

if (resource !== "user") usage();

(async () => {
  try {
    switch (command) {
      case "list":
        await cmdList();
        break;
      case "create":
        await cmdCreate();
        break;
      case "passwd":
        await cmdPasswd(args[0]);
        break;
      case "delete":
        await cmdDelete(args[0]);
        break;
      default:
        usage();
    }
  } catch (err) {
    console.error("\nError:", err.message ?? err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
