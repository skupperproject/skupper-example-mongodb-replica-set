rs.initiate( {
   _id : "rs0",
   members: [
      { _id: 0, host: "mongo-a:27017" },
      { _id: 1, host: "mongo-b:27017" },
      { _id: 2, host: "mongo-c:27017" }
   ]
})
