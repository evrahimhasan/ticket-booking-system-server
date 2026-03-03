const express = require('express')
const cors = require('cors')
require('dotenv').config()

const port = process.env.PORT || 3000

// stripe 
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

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
        const TicketCollection = database.collection('tickets')
        const BookingCollection = database.collection("bookings");

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
        // app.post('/tickets', async (req, res) => {
        //     const data = req.body
        //     data.createdAt = new Date()
        //     const result = await TicketCollection.insertOne(data)
        //     res.send(result)
        // })

        app.post('/tickets', async (req, res) => {

            const data = req.body

            const totalSeats = data.totalSeats || 40
            const seatsPerRow = 4
            const rowCount = totalSeats / seatsPerRow

            const rows = Array.from({ length: rowCount }, (_, i) =>
                String.fromCharCode(65 + i) // A,B,C...
            )

            const seats = rows.flatMap(row =>
                Array.from({ length: seatsPerRow }, (_, i) => ({
                    seatNo: `${row}${i + 1}`,
                    status: "AVAILABLE"
                }))
            )

            data.seats = seats
            data.seatsLeft = seats.length
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


        // Get Single Ticket
        app.get('/tickets/:id', async (req, res) => {

            const id = req.params.id

            const result = await TicketCollection.findOne({
                _id: new ObjectId(id)
            })

            res.send(result)

        })




        //payment api
        app.post("/create-payment-intent", async (req, res) => {
            const { amount } = req.body;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount * 100,
                currency: "bdt",
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });


        // confirm booking
        app.post("/confirm-booking", async (req, res) => {
            const { ticketId, selectedSeats, userEmail, totalAmount } = req.body;

            const ticket = await TicketCollection.findOne({ _id: new ObjectId(ticketId) });

            const unavailable = ticket.seats.filter(
                seat =>
                    selectedSeats.includes(seat.seatNo) &&
                    seat.status === "BOOKED"
            );

            if (unavailable.length > 0) {
                return res.status(400).send({ message: "Seat already booked!" });
            }

            // Update seats
            await TicketCollection.updateOne(
                { _id: new ObjectId(ticketId), "seats.seatNo": { $in: selectedSeats } },
                {
                    $set: { "seats.$[elem].status": "BOOKED" }
                },
                {
                    arrayFilters: [{ "elem.seatNo": { $in: selectedSeats } }]
                }
            );

            // ✅ Save booking info
            await BookingCollection.insertOne({
                ticketId,
                userEmail,
                selectedSeats,
                totalAmount,
                bookingDate: new Date()
            });

            res.send({ message: "Booking confirmed" });
        });


        // get my tickets
        app.get("/my-bookings/:email", async (req, res) => {
            const userEmail = req.params.email;
            const bookings = await BookingCollection.find({ userEmail }).toArray();
            res.send(bookings);
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