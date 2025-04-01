<!-- NOTE: This file is generated from skewer.yaml.  Do not edit it directly. -->

# Accessing a distributed Mongo database using Skupper

[![main](https://github.com/lynnemorrison/skupper-example-mongodb-replica-set/actions/workflows/main.yaml/badge.svg)](https://github.com/lynnemorrison/skupper-example-mongodb-replica-set/actions/workflows/main.yaml)

#### Deploying a MongoDB database replica set across clusters

This example is part of a [suite of examples][examples] showing the
different ways you can use [Skupper][website] to connect services
across cloud providers, data centers, and edge sites.

[website]: https://skupper.io/
[examples]: https://skupper.io/examples/index.html

#### Contents

* [Overview](#overview)
* [Prerequisites](#prerequisites)
* [Step 1: Install the Skupper command-line tool](#step-1-install-the-skupper-command-line-tool)
* [Step 2: Access your Kubernetes clusters](#step-2-access-your-kubernetes-clusters)
* [Step 3: Install Skupper on your Kubernetes clusters](#step-3-install-skupper-on-your-kubernetes-clusters)
* [Step 4: Create your sites](#step-4-create-your-sites)
* [Step 5: Link your sites](#step-5-link-your-sites)
* [Step 6: Deploy MongoDB Servers](#step-6-deploy-mongodb-servers)
* [Step 7: Create Skupper services for the Virtual Application Network](#step-7-create-skupper-services-for-the-virtual-application-network)
* [Step 8: Form the MongoDB replica set](#step-8-form-the-mongodb-replica-set)
* [Step 9: Insert documents](#step-9-insert-documents)
* [Step 10: Observe replication](#step-10-observe-replication)
* [Step 11: Cleaning up](#step-11-cleaning-up)
* [Next steps](#next-steps)
* [About this example](#about-this-example)

## Overview

This tutorial demonstrates how to share a MongoDB database across multiple
Kubernetes clusters that are located in different public and private cloud
providers.

In this tutorial, you will deploy a three-member MongoDB replica set in which
each member is located in its own cluster. You will also create a Virtual
Application Nework for the servers, which will enable the members to form the
replica set and communicate with each other.

## Prerequisites

* Access to at least one Kubernetes cluster, from [any provider you
  choose][kube-providers].

* The `kubectl` command-line tool, version 1.15 or later
  ([installation guide][install-kubectl]).

* The `skupper` command-line tool, version 2.0 or later.  On Linux
  or Mac, you can use the install script (inspect it
  [here][cli-install-script]) to download and extract the command:

[kube-providers]: https://skupper.io/start/kubernetes.html
[install-kubectl]: https://kubernetes.io/docs/tasks/tools/install-kubectl/
[cli-install-script]: https://github.com/skupperproject/skupper-website/blob/main/input/install.sh
[cli-install-docs]: https://skupper.io/install/

## Step 1: Install the Skupper command-line tool

This example uses the Skupper command-line tool to create Skupper
resources.  You need to install the `skupper` command only once
for each development environment.

On Linux or Mac, you can use the install script (inspect it
[here][install-script]) to download and extract the command:

~~~ shell
curl https://skupper.io/install.sh | sh -s -- --version 2.0.0
~~~

The script installs the command under your home directory.  It
prompts you to add the command to your path if necessary.

For Windows and other installation options, see [Installing
Skupper][install-docs].

[install-script]: https://github.com/skupperproject/skupper-website/blob/main/input/install.sh
[install-docs]: https://skupper.io/install/

## Step 2: Access your Kubernetes clusters

Skupper is designed for use with multiple Kubernetes clusters.
The `skupper` and `kubectl` commands use your
[kubeconfig][kubeconfig] and current context to select the cluster
and namespace where they operate.

[kubeconfig]: https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/

This example uses multiple cluster contexts at once. The
`KUBECONFIG` environment variable tells `skupper` and `kubectl`
which kubeconfig to use.

For each cluster, open a new terminal window.  In each terminal,
set the `KUBECONFIG` environment variable to a different path and
log in to your cluster.

_**Public1:**_

~~~ shell
export KUBECONFIG=~/.kube/config-public1
#Enter your provider-specific login command
kubectl create namespace public1
kubectl config set-context --current --namespace public1
~~~

_**Public2:**_

~~~ shell
export KUBECONFIG=~/.kube/config-public2
#Enter your provider-specific login command
kubectl create namespace public2
kubectl config set-context --current --namespace public2
~~~

_**Private1:**_

~~~ shell
export KUBECONFIG=~/.kube/config-private1
#Enter your provider-specific login command
kubectl create namespace private1
kubectl config set-context --current --namespace private1
~~~

**Note:** The login procedure varies by provider.

## Step 3: Install Skupper on your Kubernetes clusters

Using Skupper on Kubernetes requires the installation of the
Skupper custom resource definitions (CRDs) and the Skupper
controller.

For each cluster, use `kubectl apply` with the Skupper
installation YAML to install the CRDs and controller.

_**Public1:**_

~~~ shell
kubectl apply -f https://skupper.io/v2/install.yaml
~~~

_**Public2:**_

~~~ shell
kubectl apply -f https://skupper.io/v2/install.yaml
~~~

_**Private1:**_

~~~ shell
kubectl apply -f https://skupper.io/v2/install.yaml
~~~

## Step 4: Create your sites

A Skupper _site_ is a location where components of your
application are running.  Sites are linked together to form a
network for your application.  In Kubernetes, a site is associated
with a namespace.

Use the kubectl apply command to declaratively create sites in the kubernetes
namespaces. This deploys the Skupper router. Then use kubectl get site to see
the outcome.

**Note:** If you are using Minikube, you need to [start minikube
tunnel][minikube-tunnel] before you run `skupper init`.

[minikube-tunnel]: https://skupper.io/start/minikube.html#running-minikube-tunnel

_**Public1:**_

~~~ shell
kubectl apply -f ./public1-crs/site.yaml
kubectl wait --for condition=Ready --timeout=3m site/public1
~~~

_Sample output:_

~~~ console
$ kubectl wait --for condition=Ready --timeout=3m site/public1
site.skupper.io/public1 created
site.skupper.io/public1 condition met
~~~

_**Public2:**_

~~~ shell
kubectl apply -f ./public2-crs/site.yaml
kubectl wait --for condition=Ready --timeout=3m site/public2
~~~

_Sample output:_

~~~ console
$ kubectl wait --for condition=Ready --timeout=3m site/public2
site.skupper.io/public2 created
site.skupper.io/public2 condition met
~~~

_**Private1:**_

~~~ shell
kubectl apply -f ./private1-crs/site.yaml
kubectl wait --for condition=Ready --timeout=3m site/private1
~~~

_Sample output:_

~~~ console
$ kubectl wait --for condition=Ready --timeout=3m site/private1
site.skupper.io/private1 created
site.skupper.io/private1 condition met
~~~

## Step 5: Link your sites

A Skupper _link_ is a channel for communication between two sites.
Links serve as a transport for application connections and
requests.

Creating a link requires use of two `skupper` commands in
conjunction, `skupper token issue` and `skupper token redeem`.

The `skupper token issue` command generates a secret token that
signifies permission to create a link.  The token also carries the
link details.  Then, in a remote site, The `skupper token
redeem` command uses the token to create a link to the site
that generated it.

**Note:** The link token is truly a *secret*.  Anyone who has the
token can link to your site.  Make sure that only those you trust
have access to it.

First, use `skupper token issue` in public1 to generate the
token.  Then, use `skupper token redeem` in public2 to link the
sites.  Using the flag redemptions-allowed specifies how many tokens
are created.  In this scenario public2 and private1 will connect to
public1 so we will need two tokens.

_**Public1:**_

~~~ shell
skupper token issue ./public1.token --redemptions-allowed 2
~~~

_**Public2:**_

~~~ shell
skupper token redeem ./public1.token
skupper token issue ./public2.token
~~~

_**Private1:**_

~~~ shell
skupper token redeem ./public1.token
skupper token redeem ./public2.token
~~~

If your terminal sessions are on different machines, you may need
to use `scp` or a similar tool to transfer the token securely.  By
default, tokens expire after a single use or 15 minutes after
creation.

## Step 6: Deploy MongoDB Servers

After creating the Skupper network, deploy the servers for the three-member 
MongoDB replica set. The member in the private cloud will be designated as the
primary, and the members on the public cloud clusters will be redundant backups

_**Private1:**_

~~~ shell
kubectl apply -f ./private1-crs/deployment-mongo-a.yaml
~~~

_Sample output:_

~~~ console
$ kubectl apply -f ./private1-crs/deployment-mongo-a.yaml
deployment.apps/mongo-a created
~~~

_**Public1:**_

~~~ shell
kubectl apply -f ./public1-crs/deployment-mongo-b.yaml
~~~

_Sample output:_

~~~ console
$ kubectl apply -f ./public1-crs/deployment-mongo-b.yaml
deployment.apps/mongo-b created
~~~

_**Public2:**_

~~~ shell
kubectl apply -f ./public2-crs/deployment-mongo-c.yaml
~~~

_Sample output:_

~~~ console
$ kubectl apply -f ./public2-crs/deployment-mongo-c.yaml
deployment.apps/mongo-c created
~~~

## Step 7: Create Skupper services for the Virtual Application Network

Create Skupper listeners and connectors to expose the mongodb in each namespace.

_**Private1:**_

~~~ shell
kubectl apply -f ./private1-crs/listener.yaml
kubectl apply -f ./private1-crs/connector.yaml
~~~

_Sample output:_

~~~ console
$ kubectl apply -f ./private1-crs/connector.yaml
listener.skupper.io/mongo-a created
listener.skupper.io/mongo-c created
listener.skupper.io/mongo-b created
connector.skupper.io/mongo-a created
~~~

_**Public1:**_

~~~ shell
kubectl apply -f ./public1-crs/listener.yaml
kubectl apply -f ./public1-crs/connector.yaml
~~~

_Sample output:_

~~~ console
$ kubectl apply -f ./public1-crs/connector.yaml
listener.skupper.io/mongo-a created
listener.skupper.io/mongo-c created
listener.skupper.io/mongo-b created
connector.skupper.io/mongo-b created
~~~

_**Public2:**_

~~~ shell
kubectl apply -f ./public2-crs/listener.yaml
kubectl apply -f ./public2-crs/connector.yaml
~~~

_Sample output:_

~~~ console
$ kubectl apply -f ./public2-crs/connector.yaml
listener.skupper.io/mongo-a created
listener.skupper.io/mongo-c created
listener.skupper.io/mongo-b created
connector.skupper.io/mongo-c created
~~~

## Step 8: Form the MongoDB replica set

After deploying the MongoDB members into the private and public cloud clusters,
form them into a replica set. The application router network connects the members
and enables them to form the replica set even though they are running in separate
clusters.

In the terminal for the private1 cluser, use the mongo shell to connect to the
mongo-a instance and initiate the member set formation, making mongo-a the primary.

_**Private1:**_

~~~ shell
kubectl exec -it deploy/mongo-a -- mongosh --host mongo-a
#Execute the following command on the running pod:
rs.initiate( { _id : "rs0", members: [
{ _id: 0, host: "mongo-a:27017", priority: 1 },
{ _id: 1, host: "mongo-b:27017", priority: 0.5 },
{ _id: 2, host: "mongo-c:27017", priority: 0.5 }
] })
~~~

## Step 9: Insert documents

Now that the MongoDB members have formed a replica set and are connected by the
application router network, you can insert some documents on the primary member,
and see them replicated to the backup members.

_**Private1:**_

~~~ shell
kubectl exec -it deploy/mongo-a -- mongosh --host mongo-a
#Execute the following commands on the running pod:
rs.status()
for (i=0; i<1000; i++) {db.coll.insertOne({count: i})}
db.coll.countDocuments()
~~~

_Sample output:_

~~~ console
$ db.coll.countDocuments()
1000
~~~

## Step 10: Observe replication

Using the mongo shell, check the backup members to verify that they have a copy
of the documents that you inserted:

_**Public1:**_

~~~ shell
kubectl exec -it deploy/mongo-b -- mongosh
#Execute the following commands on the running pod:
db.getMongo().setReadPref('secondary')
db.coll.countDocuments()
db.coll.find()
~~~

_Sample output:_

~~~ console
$ db.coll.countDocuments()
1000
~~~

_**Public2:**_

~~~ shell
kubectl exec -it deploy/mongo-c -- mongosh
#Execute the following commands on the running pod:
db.getMongo().setReadPref('secondary')
db.coll.countDocuments()
db.coll.find()
~~~

_Sample output:_

~~~ console
$ db.coll.countDocuments()
1000
~~~

## Step 11: Cleaning up

Restore your cluster environment by returning the resource created in the
demonstration. On each cluster, delete the demo resources and the skupper network:

_**Private1:**_

~~~ shell
skupper site delete --all
kubectl delete -f ./private1-crs/deployment-mongo-a.yaml
~~~

_**Public1:**_

~~~ shell
skupper site delete --all
kubectl delete -f ./public1-crs/deployment-mongo-b.yaml
~~~

_**Public2:**_

~~~ shell
skupper site delete --all
kubectl delete -f ./public2-crs/deployment-mongo-c.yaml
~~~

## Next steps

Check out the other [examples][examples] on the Skupper website.

## About this example

This example was produced using [Skewer][skewer], a library for
documenting and testing Skupper examples.

[skewer]: https://github.com/skupperproject/skewer

Skewer provides utility functions for generating the README and
running the example steps.  Use the `./plano` command in the project
root to see what is available.

To quickly stand up the example using Minikube, try the `./plano demo`
command.
