rs.initiate( {
   _id : "rs0",
   members: [
      { _id: 0, host: "mongo-a:27017", priority: 1 },
      { _id: 1, host: "mongo-b:27017", priority: 0.5 },
      { _id: 2, host: "mongo-c:27017", priority: 0.5 }
   ]
})
