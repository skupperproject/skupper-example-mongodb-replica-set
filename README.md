# Sharing a MongoDB database across clusters

This tutorial demonstrates how to share a MongoDB database across multiple Kubernetes clusters that are located in different public and private cloud providers.

In this tutorial, you will deploy a three-member MongoDB replica set in which each member is located in its own cluster. You will also create an application router network, which will enable the members to form the replica set and communicate with each other.

To complete this tutorial, do the following:

* [Prerequisites](#prerequisites)
* [Step 1: Set up the demo](#step-1-set-up-the-demo)
* [Step 2: Define Cluster Topology Values](#step-2-define-cluster-topology-values)
* [Step 3: Generate Cluster Network Files](#step-3-generate-cluster-network-yaml)
* [Step 4: Deploy Application Router Network](#step-4-deploy-application-router-network)
* [Step 5: Deploy the cloud-redundant MongoDB replica set](#step-5-deploy-the-cloud-redundant-mongodb-replica-set)
* [Step 6: Form the MongoDB replica set](#step-6-form-the-mongodb-replica-set)
* [Step 7: Insert documents and observe replication](#step-7-insert-documents-and-observe-replication)
* [Next steps](#next-steps)

## Prerequisites

You must have access to three OpenShift clusters:
* A "private cloud" cluster running on your local machine
* Two public cloud clusters running in public cloud providers

For each cluster, you will need the following information:

* Cluster Name (example: "mycluster1")
* Cluster Domain (example: "devcluster.openshift.com")

## Step 1: Set up the demo

1. On your local machine, make a directory for this tutorial and clone the following repos into it:

   ```bash
   $ mkdir mongodb-replica-demo
   $ cd mongodb-replica-demo
   $ git clone git@github.com:skubaproject/skoot.git # for creating the application router network
   $ git clone git@github.com:skubaproject/skupper-example-mongodb-replica.git # for deploying the MongoDB members
   ```

2. Prepare the OpenShift clusters.

   1. Log in to each OpenShift cluster in a separate terminal session. You should have one cluster running locally on your machine, and two clusters running in public cloud providers.
   2. In each cluster, create a namespace for this demo.
  
      ```bash
      $ oc new-project mongodb-replica-demo
      ```

## Step 2: Define Cluster Topology Values

Define the values for the application router network topology by setting up the required
environment variables. Presently, the example deployments can support up to three public
clusters and up to three private clusters.The following depicts an example deployment for
two public clusters and one private cluster:

   ```bash
   $ export SKUPPER_PUBLIC_CLUSTER_COUNT=2
   $ export SKUPPER_PRIVATE_CLUSTER_COUNT=1
   $ export SKUPPER_NAMESPACE="mongodb-replica-demo"
   $ export SKUPPER_PUBLIC_CLUSTER_SUFFIX_1="mycluster1.devcluster.openshift.com"
   $ export SKUPPER_PUBLIC_CLUSTER_SUFFIX_2="mycluster2.devcluster.openshift.com"
   $ export SKUPPER_PUBLIC_CLUSTER_NAME_1="us-east"
   $ export SKUPPER_PUBLIC_CLUSTER_NAME_2="us-west"
   $ export SKUPPER_PRIVATE_CLUSTER_NAME_1="on-prem"
   ```

## Step 3: Generate Cluster Network Files

To generate the deployment yaml files for the defined topology, execute the following:

   ```bash
   $ ~mongodb-replica-demo/skoot/scripts/arn.sh | docker run -i quay.io/skupper/skoot | tar --extract
   ```

## Step 4: Deploy Application Router Network

Log in to each cluster, create the common namespace from above and deploy the corresponding yaml file.

1. In the terminal for the private cloud, deploy the application router:

   ```bash
   $ oc apply -f ~/mongodb-replica-demo/yaml/on-prem.yaml
   ```
2. In the terminal for the first public cloud, deploy the application router:

   ```bash
   $ oc apply -f ~/mongodb-replica-demo/yaml/us-east.yaml
   ```
3. In the terminal for the second public cloud, deploy the application router:

   ```bash
   $ oc apply -f ~/mongodb-replica-demo/yaml/us-west.yaml
   ```

## Step 5: Deploy the cloud-redundant MongoDB replica set

After creating the application router network, you deploy the three-member MongoDB replica set. The member in the private cloud will be designated as the primary, and the members on the public cloud clusters will be redundant backups.

The `demos/mongoDB-replica` directory contains the YAML files that you will use to create the MongoDB members. Each YAML file describes the set of Kubernetes resources needed to create a MongoDB member and connect it to the application router network.

1. In the terminal for the private cloud, deploy the primary MongoDB member:

   ```bash
   $ oc apply -f ~/mongodb-replica-demo/skupper-example-mongodb-replica/deployment-mongo-svc-a.yaml
   ```

2. In the terminal for the first public cloud, deploy the first backup MongoDB member:

   ```bash
   $ oc apply -f ~/mongodb-replica-demo/skupper-example-mongodb-replica/deployment-mongo-svc-b.yaml
   ```

3. In the terminal for the second public cloud, deploy the second backup MongoDB member:

   ```bash
   $ oc apply -f ~/mongodb-replica-demo/skupper-example-mongodb-replica/deployment-mongo-svc-c.yaml
   ```

## Step 6: Form the MongoDB replica set

After deploying the MongoDB members into the private and public cloud clusters, form them into a replica set. The application router network connects the members and enables them to form the replica set even though they are running in separate clusters.  

1. In the terminal for the private cloud, use the `mongo` shell to connect to
the `mongo-svc-a` instance and initiate the member set formation:

   ```bash
   $ cd ~/mongodb-replica-demo/skupper-example-mongodb-replica
   $ mongo --host $(oc get service mongo-svc-a -o=jsonpath='{.spec.clusterIP}')
   > load("replica.js")
   ```

2. Verify the status of the members array.

   ```bash
   > rs.status()
   ```

## Step 7: Insert documents and observe replication

Now that the MongoDB members have formed a replica set and are connected by the application router network, you can insert some documents on the primary member, and see them replicated to the backup members.

1. While staying connected to the `mongo-svc-a` shell, insert some documents:

   ```bash
   > use test
   > for (i=0; i<1000; i++) {db.coll.insert({count: i})}
   # make sure the docs are there:
   > db.coll.count()
   ```

2. Check the first backup member to verify that it has a copy of the documents that you inserted. You can acquire a connection to a backup member by instantiating a connection object using the `Mongo()` constructor within the `mongo-svc-a` shell:

   ```bash
   > msbConn = new Mongo("mongo-svc-b")
   > msbDB = msbConn.getDB("test")
   > msbDB.setSlaveOk()
   > msbDB.coll.find()
   ```

3. Check the second backup member to verify that it also has a copy of the documents.

   ```bash
   > mscConn = new Mongo("mongo-svc-c")
   > mscDB = mscConn.getDB("test")
   > msbDB.setSlaveOk()
   > mscDB.coll.find()
   ```

## Next steps

TODO: describe what the user should do after completing this tutorial
