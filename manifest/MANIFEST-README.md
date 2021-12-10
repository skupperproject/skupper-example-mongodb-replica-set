# Deploying a MongoDB database replica set across clusters using site-controller with manifest

1. In the terminal for the private cluster (north):

   ```bash
   kubectl apply -f deploy-watch-current-ns.yaml
   kubectl apply -f deployment-mongo-a-with-annotations.yaml
   ```

2. In the terminal for the first public cluster (south):

   ```bash
   kubectl apply -f deploy-watch-current-ns.yaml
   kubectl apply -f deployment-mongo-b-with-annotations.yaml
   ```

3. In the terminal for the first public cluster (east):

   ```bash
   kubectl apply -f deploy-watch-current-ns.yaml
   kubectl apply -f deployment-mongo-c-with-annotations.yaml
   ```

4. In the terminal for the first public cluster (south):

   ```bash
   kubectl get secret mongo-south -o yaml > ./mongo-south.yaml
   ```

5. In the terminal for the second public cluster (east):

   ```bash
   kubectl get secret mongo-east -o yaml > ./mongo-east.yaml
   kubectl apply -f ./mongo-south.yaml
   ```

6. In the terminal for the private cluster (north):

   ```bash
   kubectl apply -f ./mongo-south.yaml
   kubeclt apply -f ./mongo-east.yaml
   ```

7. In the terminal for the private cluster(north):

   ```bash
   $ skupper gateway init --config ./mongo-gateway-forward.yaml
   $ mongo --port 27017
   > load("../replica.js")
   ```

8. Verify the status of the members array.

   ```bash
   > rs.status()
   ```
