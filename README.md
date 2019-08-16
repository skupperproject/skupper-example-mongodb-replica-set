# Sharing a MongoDB database across clusters

This tutorial demonstrates how to share a MongoDB database across multiple Kubernetes clusters that are located in different public and private cloud providers.

In this tutorial, you will deploy a three-member MongoDB replica set in which each member is located in its own cluster. You will also create an application router network, which will enable the members to form the replica set and communicate with each other.

TODO: Explain why this topology is so difficult, and how the application router network simplifies it.

TODO: Add a simple network topology diagram.

To complete this tutorial, do the following:

* [Prerequisites](#prerequisites)
* [Step 1: Set up the demo](#step-1-set-up-the-demo)
* [Step 2: Create the application router network](#step-2-create-the-application-router-network)
* [Step 3: Deploy the cloud-redundant MongoDB replica set](#step-3-deploy-the-cloud-redundant-mongodb-replica-set)
* [Step 4: Form the MongoDB replica set](#step-4-form-the-mongodb-replica-set)
* [Step 5: Insert documents and observe replication](#step-5-insert-documents-and-observe-replication)
* [Next steps](#next-steps)

## Prerequisites

You must have access to three OpenShift clusters:
* A "private cloud" cluster running on your local machine
* Two public cloud clusters running in public cloud providers

## Step 1: Set up the demo

1. On your local machine, make a directory for this tutorial and clone the following repos into it:

   ```bash
   $ mkdir mongodb-replica-demo
   $ cd mongodb-replica-demo
   $ git clone git@github.com:skubaproject/skoot.git # for creating the application router network
   $ git clone git@github.com:skubaproject/demos.git # for deploying the MongoDB members
   ```

2. Prepare the OpenShift clusters.

   1. Log in to each OpenShift cluster in a separate terminal session. You should have one cluster running locally on your machine, and two clusters running in public cloud providers.
   2. In each cluster, create a namespace for this demo.
  
      ```bash
      $ oc new-project mongodb-replica-demo
      ```

## Step 2: Create the application router network

The application router network provides connectivity across the three clusters without the need for special network and firewall configuration rules.

1. Open the `mongodb-replica-demo/demos/topology2/skoot-topology2.conf` file.

2. Replace the variables with the names of your OpenShift clusters and namespaces.

   <dl>
   <dt>`${OPENSHIFT_CLUSTER_NAME_1}`</dt>
   <dd>The name of the first public cloud cluster.</dd>
   <dt>`${NAMESPACE_1}`</dt>
   <dd>The name of the namespace on the first public cloud cluster.</dd>
   <dt>`${OPENSHIFT_CLUSTER_NAME_2}`</dt>
   <dd>The name of the second public cloud cluster.</dd>
   <dt>`${NAMESPACE_2}`</dt>
   <dd>The name of the namespace on the second public cloud cluster.</dd>
   <dt>`${NAMESPACE_3}`</dt>
   <dd>The name of the namespace on the private cloud cluster that is running on your local machine.</dd>
   </dl>

3. Use `skoot` to create the application router network.

   ```bash
   $ cd ~/mongodb-replica-demo/skoot/python/tools
   $ source export_path.sh
   $ skoot -c -o ~/mongodb-replica-demo/demos/topology2/skoot-topology2.conf
   ```

4. Verify that the application router network is created.
  
   1. In a web browser, access the web console for the application router network. The URL for the web console is `console.${NAMESPACE_3}.127.0.0.1.nip.io`.
   2. Click the **Topology** tab.

   TODO: add a screenshot

## Step 3: Deploy the cloud-redundant MongoDB replica set

After creating the application router network, you deploy the three-member MongoDB replica set. The member in the private cloud will be designated as the primary, and the members on the public cloud clusters will be redundant backups.

The `demos/mongoDB-replica` directory contains the YAML files that you will use to create the MongoDB members. Each YAML file describes the set of Kubernetes resources needed to create a MongoDB member and connect it to the application router network.

TODO: create a project/namespace, same as topology deployment

1. In the terminal for the private cloud, deploy the primary MongoDB member:

   ```bash
   $ cd ~/mongodb-replica-demo/demos/mongoDB-replica/
   $ oc apply -f deployment-mongo-svc-a.yaml
   ```

2. In the terminal for the first public cloud, deploy the first backup MongoDB member:

   ```bash
   $ cd ~/mongodb-replica-demo/demos/mongoDB-replica/
   $ oc apply -f deployment-mongo-svc-b.yaml
   ```

3. In the terminal for the second public cloud, deploy the second backup MongoDB member:

   ```bash
   $ cd ~/mongodb-replica-demo/demos/mongoDB-replica/
   $ oc apply -f deployment-mongo-svc-c.yaml
   ```

## Step 4: Form the MongoDB replica set

After deploying the MongoDB members into the private and public cloud clusters, form them into a replica set. The application router network connects the members and enables them to form the replica set even though they are running in separate clusters.  

1. In the terminal for the private cloud, use the `mongo` shell to connect to
the `mongo-svc-a` instance and initiate the member set formation:

   ```bash
   $ mongo --host $(oc get service mongo-svc-a -o=jsonpath='{.spec.clusterIP}')
   > load("replica.js")
   ```

2. Verify the status of the members array.

   ```bash
   > rs.status()
   ```

## Step 5: Insert documents and observe replication

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
   > msbDB.coll.find()
   > msbDB.setSlaveOk()
   ```

TODO: either add addresses to /etc/hosts or lookup address for svc

3. Check the second backup member to verify that it also has a copy of the documents.

   ```bash
   > mscConn = new Mongo("mongo-svc-c")
   > mscDB = mscConn.getDB("test")
   > mscDB.coll.find()
   ```

TODO: example of primary failover, how to initiate and observe

## Next steps

TODO: describe what the user should do after completing this tutorial
