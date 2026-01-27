const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const express = require('express');
const jobQueue = require('./queue/jobQueue');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(jobQueue)],
  serverAdapter,
});

const app = express();
app.use('/admin/queues', serverAdapter.getRouter());

app.listen(3001, () => console.log('Bull Board running on port 3001'));
