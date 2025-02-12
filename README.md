# Deploying a MongoDB database replica set across clusters

This tutorial demonstrates how to share a MongoDB database across multiple Kubernetes clusters that are located in different public and private cloud providers.

In this tutorial, you will deploy a three-member MongoDB replica set in which each member is located in its own cluster. You will also create a Virtual Application Nework for the servers, which will enable the members to form the replica set and communicate with each other.

To complete this tutorial, do the following:

* [Prerequisites](#prerequisites)
* [Step 1: Set up the demo](#step-1-set-up-the-demo)
* [Step 2: Deploy the Virtual Application Network](#step-2-deploy-the-virtual-application-network)
* [Step 3: Deploy the MongoDB servers](#step-3-deploy-the-mongodb-servers)
* [Step 4: Create Skupper services for the Virtual Application Network](#step-4-create-skupper-services-for-the-virtual-application-network)
* [Step 5: Bind the Skupper services to the deployment targets on the Virtual Application Network](#step-5-bind-the-skupper-services-to-the-deployment-targets-on-the-virtual-application-network)
* [Step 6: Form the MongoDB replica set](#step-6-form-the-mongodb-replica-set)
* [Step 7: Insert documents and observe replication](#step-7-insert-documents-and-observe-replication)
* [Cleaning up](#cleaning-up)
* [Next steps](#next-steps)

## Prerequisites

* The `kubectl` command-line tool, version 1.15 or later ([installation guide](https://kubernetes.io/docs/tasks/tools/install-kubectl/))
* The `skupper` command-line tool, version 2.0.0 or later ([installation guide](https://skupper.io/start/index.html#step-1-install-the-skupper-command-line-tool-in-your-environment))
* The `mongo` command-line tool 4.4 or later ***(Optional)*** ([installation guide](https://www.mongodb.com/docs/mongocli/stable/install/))

The basis for the demonstration is to depict the operation of a MongoDB replica set across distributed clusters. You should have access to three independent clusters to operate and observe the distribution of services over a Virtual Application Network. As an example, the three cluster might be comprised of:

* A private cloud cluster running on your local machine
* Two public cloud clusters running in public cloud providers

While the detailed steps are not included here, this demonstration can alternatively be performed with three separate namespaces on a single cluster. 

## Step 1: Set up the demo

1. On your local machine, make a directory for this tutorial and clone the example repo into it:

   ```bash
   mkdir mongodb-demo
   cd mongodb-demo
   git clone https://github.com/skupperproject/skupper-example-mongodb-replica-set.git
   ```

2. Prepare the target clusters.

   1. On your local machine, log in to each cluster in a separate terminal session.
   2. In each cluster, create a namespace to use for the demo.
   3. In each cluster, set the kubectl config context to use the demo namespace [(see kubectl cheat sheet)](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)

## Step 2: Install the Skupper Controller
Create a Skupper Controller at cluster scope. All Skupper routers in the cluster can share one controller. The Skupper Controller will be created in skupper namespace.

Use the kubectl apply command to declaratively create the controller in the kubernetes skupper namespace. Then use kubectl get pods -n skupper to see the outcome
```bash
   kubectl apply -f https://github.com/skupperproject/skupper/releases/download/2.0.0-preview-2/skupper-setup-cluster-scope.yaml
   ```

## Step 3: Deploy the Virtual Application Network

On each cluster, using the `skupper` tool, define the Virtual Application Network and the connectivity for the peer clusters.

1. In the terminal for the first public cluster, deploy the **public1** application router. Create a connection token for connections from the **public2** cluster and the **private1** cluster:

   ```bash
   kubectl apply -f public1-crs/site.yaml
   kubectl wait --for condition=Ready --timeout=60s site/public1

   skupper token issue ./public1-token.yaml --redemptions-allowed 2
   ```

2. In the terminal for the second public cluster, deploy the **public2** application router. Create a connection token for connections from the **private1** cluser and connect to the **public1** cluster:

   ```bash
   kubectl apply -f public2-crs/site.yaml
   kubectl wait --for condition=Ready --timeout=60s site/public2

   skupper token issue ./public2-token.yaml
   skupper token redeem ./public1-token.yaml
   ```

3. In the terminal for the private cluster, deploy the **private1** application router. Connect to the **public1** and **public2** clusters;

   ```bash
   kubectl apply -f private1-crs/site.yaml
   kubectl wait --for condition=Ready --timeout=60s site/private1

   skupper token redeem ./public1-token.yaml
   skupper token redeem ./public2-token.yaml
   ```
## Step 4: Deploy the MongoDB servers

After creating the Skupper network, deploy the servers for the three-member MongoDB replica set. The member in the private cloud will be designated as the primary, and the members on the public cloud clusters will be redundant backups.

1. In the terminal for the **private1** cluster, deploy the primary MongoDB member:

   ```bash
   kubectl apply -f private1-crs/deployment-mongo-a.yaml
   ```

2. In the terminal for the **public1** cluster, deploy the first backup MongoDB member:

   ```bash
   kubectl apply -f public1-crs/deployment-mongo-b.yaml
   ```

3. In the terminal for the **public2** cluster, deploy the second backup MongoDB member:

   ```bash
   kubectl apply -f public2-crs/deployment-mongo-c.yaml
   ```

## Step 5: Create Skupper listeners and connectors for the Virtual Application Network

1. In the terminal for the **private1** cluster, create the mongo-a service:

   ```bash
   kubectl apply -f private1-crs/listener.yaml
   kubectl apply -f private1-crs/connector.yaml
   ```

2. In the terminal for the **public1** cluster, create the mongo-b service:

   ```bash
   kubectl apply -f public1-crs/listener.yaml
   kubectl apply -f public1-crs/connector.yaml
   ```

3. In the terminal for the **public2** cluster, create the mongo-c service:

   ```bash
   kubectl apply -f public2-crs/listener.yaml
   kubectl apply -f public2-crs/connector.yaml
   ```

4. In each of the cluster terminals, verify the mongo-a, mongo-b and mongo-c services are created:

   ```bash
   kubectl get service
   ```

    Note that the mapping for the service address defaults to `tcp`


5. In each of the cluster terminals, verify connectors and listeners are OK:

   ```bash
   skupper connector status
   skupper listener status
   ```

## Step 6: Form the MongoDB replica set

After deploying the MongoDB members into the private and public cloud clusters, form them into a replica set. The application router network connects the members and enables them to form the replica set even though they are running in separate clusters.  

1. In the terminal for the **private1** cluser, use the `mongo` shell to connect to
the `mongo-a` instance and initiate the member set formation:

   1.1. Use this if you have the mongo (command-line tool) installed and you are running your private1 site locally

   ```bash
   $ cd ~/mongodb-demo/skupper-example-mongodb-replica-set
   $ mongosh --host $(kubectl get service mongo-a -o=jsonpath='{.spec.clusterIP}')
   > load("replica.js")
   ```

   1.2. Alternatively you can initiate the member set running the mongo command-line tool inside your running pod
   ```bash
   $ kubectl exec -it deploy/mongo-a -- mongosh --host mongo-a
   > rs.initiate( {
        _id : "rs0",
        members: [
           { _id: 0, host: "mongo-a:27017" },
           { _id: 1, host: "mongo-b:27017" },
           { _id: 2, host: "mongo-c:27017" }
        ]
     })
   ```

2. Verify the status of the members array.

   ```bash
   > rs.status()
   ```

## Step 7: Insert documents and observe replication

Now that the MongoDB members have formed a replica set and are connected by the application router network, you can insert some documents on the primary member, and see them replicated to the backup members.

1. While staying connected to the `mongo-a` shell, insert some documents:

   ```bash
   > use test
   > for (i=0; i<1000; i++) {db.coll.insertOne({count: i})}
   # make sure the docs are there:
   > db.coll.countDocuments()
   ```

2. Using the mongo shell, check the first backup member to verify that it has a copy of the documents that you inserted:

   ```bash
   $ kubectl exec -it deploy/mongo-a -- mongo --host mongo-b
   ```

   ```bash
   > use test
   > db.getMongo().setReadPref('secondary')
   > db.coll.countDocuments()
   > db.coll.find()
   ```


3. Using the mongo shell, check the second backup member to verify that it also has a copy of the documents that you inserted.

   ```bash
   $ kubectl exec -it deploy/mongo-a -- mongo --host mongo-c
   ```

   ```bash
   > use test
   > db.getMongo().setReadPref('secondary')
   > db.coll.countDocuments()
   > db.coll.find()
   ```

## Cleaning up

Restore your cluster environment by returning the resource created in the demonstration. On each cluster, delete the demo resources and the skupper network:

1. In the terminal for the **private1** cluster, delete the resources:


   ```bash
   $ kubectl delete -f private1-crs/deployment-mongo-a.yaml
   $ skupper site delete --all
   ```

2. In the terminal for the **public1** cluster, delete the resources:


   ```bash
   $ kubectl delete -f public1-crs/deployment-mongo-b.yaml
   $ skupper site delete --all
   ```

3. In the terminal for the **public2** cluster, delete the resources:


   ```bash
   $ kubectl delete -f public2-crs/deployment-mongo-c.yaml
   $ skupper site delete --all
   ```

## Next Steps

 - [Find more examples](https://skupper.io/examples/)
