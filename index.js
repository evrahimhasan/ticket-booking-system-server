const express = require('express')
const cors = require('cors')
require('dotenv').config()

const port = process.env.PORT || 3000

const app = express();
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.83ib2ra.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const database = client.db('ticket-booking')
        const userCollection = database.collection('users')
        const TicketCollection = database.collection(('tickets'))

        // User
        app.post('/users', async (req, res) => {
            const userInfo = req.body
            userInfo.role = 'user'
            userInfo.status = 'active'
            userInfo.createdAt = new Date()
            const result = await userCollection.insertOne(userInfo)
            res.send(result)
        })

        // All User
        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray()
            const totalUser = await userCollection.countDocuments()
            res.send({ user: result, totalUser })
        })



        // status change api
        app.patch('/update/user/status', async (req, res) => {
            const { email, status } = req.query
            const query = { email: email }

            const updateStatus = {
                $set: {
                    status: status
                }
            }
            const result = await userCollection.updateOne(query, updateStatus)
            res.send(result)
        })

        // User role
        app.get('/users/role/:email', async (req, res) => {
            const { email } = req.params
            const query = { email: email }
            const result = await userCollection.findOne(query)
            // console.log(result);
            res.send(result)
        })





        // Add Tickets
        app.post('/tickets', async (req, res) => {
            const data = req.body
            data.createdAt = new Date()
            const result = await TicketCollection.insertOne(data)
            res.send(result)
        })


        // Get All Tickets + Searched Tickets
        app.get('/tickets', async (req, res) => {
            try {

                const { from, to, date } = req.query;

                let query = {};

                if (from) {
                    query.from = { $regex: from, $options: "i" };
                }

                if (to) {
                    query.to = { $regex: to, $options: "i" };
                }

                if (date) {
                    query.journeyDate = date;
                }

                const tickets = await TicketCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.send(tickets);

            } catch (error) {
                res.status(500).send({ message: "Failed to fetch tickets" });
            }
        });


        // // Update Ticket
        // app.put('/edit-tickets/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: new ObjectId(id) };
        //     const result = await TicketCollection.updateOne(query);
        //     res.send(result);
        // });

        // delete tickets
        app.delete("/delete-tickets/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await TicketCollection.deleteOne(query);
            res.send(result);
        });




        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello, Dev')
})

app.listen(port, () => {
    console.log((`Server is running on ${port}`))
})