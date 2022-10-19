// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as azure from "@pulumi/azure";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as config from "./config";
import * as sql from "@pulumi/azure-native/sql";
import * as azuread from "@pulumi/azuread";

const current = azuread.getClientConfig({});


// Create a Virtual Network for the cluster
const aksVnet = new azure.network.VirtualNetwork("aks-net", {
    resourceGroupName: config.resourceGroup.name,
    addressSpaces: ["10.2.0.0/16"],
});

// Create a Subnet for the cluster
const aksSubnetId = new azure.network.Subnet("aks-net", {
    resourceGroupName: config.resourceGroup.name,
    virtualNetworkName: aksVnet.name,
    addressPrefixes: ["10.2.1.0/24"],
    serviceEndpoints : ["Microsoft.Sql"],
},
{dependsOn: [aksVnet]}
);

// Now allocate an AKS cluster.
export const k8sCluster = new azure.containerservice.KubernetesCluster("aksCluster", {
    resourceGroupName: config.resourceGroup.name,
    location: config.location,
    defaultNodePool: {
        name: "aksagentpool",
        nodeCount: config.nodeCount,
        vmSize: config.nodeSize,
        vnetSubnetId: aksSubnetId.id,

    },
    dnsPrefix: `${pulumi.getStack()}-reg-engine`,    
    linuxProfile: {
        adminUsername: "aksuser",
        sshKey: {
            keyData: config.sshPublicKey,
        },
    },
    networkProfile: {
        networkPlugin : "azure",
        loadBalancerProfile: {
            managedOutboundIpCount: 1,
        },
        loadBalancerSku: "standard",
        outboundType: "loadBalancer",
    },
    identity: {
        type: "SystemAssigned",
    },
},
{dependsOn: [aksSubnetId]}
);

/*
const publicIp = new azure.network.PublicIp("app-engine-ip", {
    resourceGroupName: k8sCluster.nodeResourceGroup,
    allocationMethod: "Static",
    domainNameLabel : "app-engine",
    sku : "Standard",
    tags: {
        service: "kubernetes-api-loadbalancer",
    },
},
{dependsOn: [k8sCluster]}
);
*/

// Expose a K8s provider instance using our custom cluster instance.
export const k8sProvider = new k8s.Provider("aksK8s", {
    kubeconfig: k8sCluster.kubeConfigRaw,
});


const sqlServer = new sql.Server("sql", {
    resourceGroupName: config.resourceGroup.name,
    location: config.location,
    administratorLogin: config.dbAdminUser,
    administratorLoginPassword: config.dbAdminUserPwd,
    version: "12.0",    
});


const database = new sql.Database("db", {
    databaseName: config.databaseSystem,
    location: config.location,
    resourceGroupName: config.resourceGroup.name,
    serverName: sqlServer.name,
    collation: "SQL_Latin1_General_CP1_CI_AS",    
    sku: {
        capacity: 2,
        family: "Gen5",
        name: "BC",
    },
},
{dependsOn: [sqlServer]}
);


const sqlVirtualNetAllowRule = new sql.VirtualNetworkRule("aksVirtualNetRule", {
    resourceGroupName: config.resourceGroup.name,
    serverName: sqlServer.name,
    virtualNetworkSubnetId: aksSubnetId.id,
    ignoreMissingVnetServiceEndpoint: true,
},
{dependsOn: [aksSubnetId]}
);

const clusterSvcsNamespace = new k8s.core.v1.Namespace(config.namespace, undefined, { provider: k8sProvider });
export const clusterSvcsNamespaceName = clusterSvcsNamespace.metadata.name;


const input2: pulumi.Input<string> =  k8sCluster.nodeResourceGroup;
export const p = k8sCluster.networkProfile.loadBalancerProfile.outboundIpAddressIds[0];


const regEngineIngress = new k8s.helm.v3.Chart(
    "sample-engine-ingress",
    {
        repo: "bitnami",
        chart: "nginx",
        version: "13.2.10",
        fetchOpts: {
            repo: "https://charts.bitnami.com/bitnami",
        },
        namespace: clusterSvcsNamespaceName,
    },
    { provider: k8sProvider },
);



export let cluster = k8sCluster.name;
export let kubeConfig = k8sCluster.kubeConfigRaw;
export let dbServer = sqlServer.name;
export let k8sFqdn = k8sCluster.fqdn;



//----------------------------------------------------
// Helper functions
//----------------------------------------------------

