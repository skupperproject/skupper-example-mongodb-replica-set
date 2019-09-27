# Deploying a MongoDB database replica set across clusters

This tutorial demonstrates how to share a MongoDB database across multiple Kubernetes clusters that are located in different public and private cloud providers.

In this tutorial, you will deploy a three-member MongoDB replica set in which each member is located in its own cluster. You will also create an application router network, which will enable the members to form the replica set and communicate with each other.

To complete this tutorial, do the following:

* [Prerequisites](#prerequisites)
* [Step 1: Set up the demo](#step-1-set-up-the-demo)
* [Step 2: Deploy the Skupper Network](#step-4-deploy-the-skupper-network)
* [Step 3: Deploy the MongoDB servers](#step-5-deploy-the-mongodb-servers)
* [Step 4: Annotate services to join the Skupper Network](#step-5-annotate-services-to-join-the-skupper-network)
* [Step 5: Form the MongoDB replica set](#step-6-form-the-mongodb-replica-set)
* [Step 6: Insert documents and observe replication](#step-7-insert-documents-and-observe-replication)
* [Next steps](#next-steps)

## Prerequisites

The basis for the demonstration is to depict the operation of a MongoDB replica set across distributed clusters. You should have access to three independent clusters to operate and observe the distribution of services over a Skupper Network. As an example, the three cluster might be comprised of:

* A "private cloud" cluster running on your local machine
* Two public cloud clusters running in public cloud providers

While the detailed steps are not included here, this demonstration can alternatively be performed with three separate namespaces on a single cluster. 

## Step 1: Set up the demo

1. On your local machine, make a directory for this tutorial, clone the example repo, and download the skupper-cli tool:

   ```bash
   mkdir mongodb-demo
   cd mongodb-demo
   git clone https://github.com/skupperproject/skupper-example-mongodb-replica-set.git
   curl -fL https://github.com/skupperproject/skupper-cli/releases/download/0.0.1-beta3/linux.tgz -o skupper.tgz
   mkdir -p $HOME/bin
   tar -xf skupper.tgz --directory $HOME/bin
   export PATH=$PATH:$HOME/bin
   ```

   To test your installation, run the 'skupper' command with no arguments. It will print a usage summary.

   ```bash
   $ skupper
   usage: skupper <command> <args>
   [...]
   ```

3. Prepare the target clusters.

   1. On your local machine, log in to each cluster in a separate terminal session.
   2. In each cluster, create a namespace to use for the demo.
   3. In each cluster, set the kubectl config context to use the demo namespace [(see kubectl cheat sheet)](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)

## Step 2: Deploy the Skupper Network

On each cluster, define the application router role and connectivity to peer clusters.

1. In the terminal for the first public cluster, deploy the *public1* application router, and create its secrets:

   ```bash
   skupper init --id public1
   skupper connection-token private1-to-public1-token.yaml
   skupper connection-token public2-to-public1-token.yaml
   ```

2. In the terminal for the second public cluster, deploy the *public2* application router, create its secrets and define its connections to the peer *public1* cluster:

   ```bash
   skupper init --id public2
   skupper connection-token private1-to-public2-token.yaml
   skupper connect public2-to-public1-token.yaml
   ```

3. In the terminal for the private cluster, deploy the *private1* application router and define its connections to the public clusters

   ```bash
   skupper init --edge --id private1
   skupper connect private1-to-public1-token.yaml
   skupper connect private1-to-public2-token.yaml
   ```
   
## Step 3: Deploy the MongoDB servers

After creating the Skupper network, deploy the servers for the three-member MongoDB replica set. The member in the private cloud will be designated as the primary, and the members on the public cloud clusters will be redundant backups.

1. In the terminal for the *private1* cluster, deploy the primary MongoDB member:

   ```bash
   kubectl apply -f ~/mongodb-demo/skupper-example-mongodb-replica-set/deployment-mongo-svc-a.yaml
   ```

2. In the terminal for the *public1* cluster, deploy the first backup MongoDB member:

   ```bash
   kubectl apply -f ~/mongodb-demo/skupper-example-mongodb-replica-set/deployment-mongo-svc-b.yaml
   ```

3. In the terminal for the *public2* cluster, deploy the second backup MongoDB member:

   ```bash
   kubectl apply -f ~/mongodb-demo/skupper-example-mongodb-replica-set/deployment-mongo-svc-c.yaml
   ```

## Step 4: Annotate services to join to the Skupper Network


1. In the terminal for the *private1* cluster, annotate the mongo-svc-a service:

   ```bash
   kubectl annotate service mongo-svc-a skupper.io/proxy=tcp
   ```

2. In the terminal for the *public1* cluster, annotate the mongo-svc-b service:

   ```bash
   kubectl annotate service mongo-svc-b skupper.io/proxy=tcp
   ```

3. In the terminal for the *public2* cluster, annotate the mongo-svc-c service:

   ```bash
   kubectl annotate service mongo-svc-c skupper.io/proxy=tcp
   ```

## Step 5: Form the MongoDB replica set

After deploying the MongoDB members into the private and public cloud clusters, form them into a replica set. The application router network connects the members and enables them to form the replica set even though they are running in separate clusters.  

1. In the terminal for the private cloud, use the `mongo` shell to connect to
the `mongo-svc-a` instance and initiate the member set formation:

   ```bash
   $ cd ~/mongodb-demo/skupper-example-mongodb-replica-set
   $ mongo --host $(kubectl get service mongo-svc-a -o=jsonpath='{.spec.clusterIP}')
   > load("replica.js")
   ```

2. Verify the status of the members array.

   ```bash
   > rs.status()
   ```

## Step 6: Insert documents and observe replication

Now that the MongoDB members have formed a replica set and are connected by the application router network, you can insert some documents on the primary member, and see them replicated to the backup members.

1. While staying connected to the `mongo-svc-a` shell, insert some documents:

   ```bash
   > use test
   > for (i=0; i<1000; i++) {db.coll.insert({count: i})}
   # make sure the docs are there:
   > db.coll.count()
   ```

2. Using the mongo shell check the first backup member to verify that it has a copy of the documents that you inserted:

   ```bash
   $ mongo --host $(kubectl get service mongo-svc-b -o=jsonpath='{.spec.clusterIP}')
   ```

   ```bash
   > use test
   > db.setSlaveOk()
   > db.coll.count()
   > db.coll.find()
   ```


3. Using the mongo shell check the second backup member to verify that it also has a copy of the documents that you inserted.

   ```bash
   $ mongo --host $(kubectl get service mongo-svc-c -o=jsonpath='{.spec.clusterIP}')
   ```

   ```bash
   > use test
   > db.setSlaveOk()
   > db.coll.count()
   > db.coll.find()
   ```

## Next steps

Restore your cluster environment by returning the resource created in the demonstration. On each cluster, delete the demo resources and the skupper network:

1. In the terminal for the *private1* cluster, delete the resources:


   ```bash
   $ kubectl delete -f ~/mongodb-demo/skupper-example-mongodb-replica-set/deployment-mongo-svc-a.yaml
   $ skupper delete
   ```

2. In the terminal for the *public1* cluster, delete the resources:


   ```bash
   $ kubectl delete -f ~/mongodb-demo/skupper-example-mongodb-replica-set/deployment-mongo-svc-b.yaml
   $ skupper delete
   ```

3. In the terminal for the *public2* cluster, delete the resources:


   ```bash
   $ kubectl delete -f ~/mongodb-demo/skupper-example-mongodb-replica-set/deployment-mongo-svc-c.yaml
   $ skupper delete
   ```

