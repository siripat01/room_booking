import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc, userAc, defaultAc } from "better-auth/plugins/admin/access";

// Define custom resources and actions for your app
const statement = {
    ...defaultStatements, // Keep default user/session permissions
    room: ["create", "view", "update", "delete", "publish"],
} as const;

export const ac = createAccessControl(statement);

// User role - basic permissions
export const userRole = ac.newRole({
    ...userAc.statements,
});

// Teacher role - can manage courses and grade students
export const teacherRole = ac.newRole({
    ...defaultAc.statements,
});

// Admin role - full access + default admin permissions
export const adminRole = ac.newRole({
    ...adminAc.statements, // Include all default admin permissions
});