const express = require('express')
const cors = require('cors')
require('dotenv').config()

const port = process.env.PORT || 3000

const app = express();
app.use(cors());
app.use(express());



app.get('/', (req,res)=>{
    res.send('Hello, Dev')
})

app.listen(port, ()=>{
    console.log((`Server is running on ${port}`))
})