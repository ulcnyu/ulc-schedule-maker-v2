import express, { Express, Request, Response } from 'express';
import path from 'path';

const app: Express = express();
const port = 3001;

app.use(express.static(path.join(__dirname, 'client/build')));

app.get('/', (_, res: Response) => {
  res.send("test");
});

app.get('/api/test', (_, res: Response) => {
  const test = { 
    "data": "this is some data"
  }

  res.json(test);
});

app.get('*', (_, res: Response) => {
  res.sendFile(path.join(__dirname, 'client/build/index.html'));
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});
