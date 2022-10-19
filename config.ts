import * as azure from "@pulumi/azure";
import * as pulumi from "@pulumi/pulumi";

// Parse and export configuration variables for this stack.
const config = new pulumi.Config();

export const location = config.get("location") || azure.Locations.EastUS;
export const nodeCount = config.getNumber("nodeCount") || 2;
export const nodeSize = config.get("nodeSize") || "Standard_B8ms";
export const resourceGroup = new azure.core.ResourceGroup("sample-engine", { location });
export const namespace = config.get("namespace") || "sample-engine";
export const containerCredentials = config.get("container-credentials") || "cred";

export const databaseSystem = config.get("database-system-name") || "MY_DB_NAME";

export const sshPublicKey = config.require("sshPublicKey");
export const repoawsUser = config.get("repo-aws-user") ;
export const repoawsPwd = config.get("repo-aws-passwd") ;
export const dbAdminUser = config.get("db-admin-user") || "master-chief" ;
export const dbAdminUserPwd = config.get("db-admin-passwd") ;
