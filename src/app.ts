import express, { Request, Response, NextFunction } from 'express';
import { createUserSchema, createBookSchema, borrowBookSchema, returnBookSchema } from './validators';
import { connectDB } from './database';

// Create express server
const app = express();
const port = 3000;
app.use(express.json());

// Create user
app.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await createUserSchema.validateAsync(req.body);
    const connection = await connectDB();
    const userName = req.body.name;
    const [result] = await connection.execute(
      'INSERT INTO USERS (NAME, BORROWED_BOOKS, RETURNED_BOOKS) VALUES (?, ?, ?)', 
      [userName, JSON.stringify([]), JSON.stringify([])]
    );
    res.status(201).json({id: (result as any).insertId, name: userName});
  } catch (error) {
    next(error);
  }
});

// Get all users
app.get('/users', async (req: Request, res: Response) => {
  const connection = await connectDB();
  const [users] = await connection.execute('SELECT ID, NAME FROM USERS');
  res.json(users);
});

// Get a user
app.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connection = await connectDB();
    const [users] = await connection.execute('SELECT * FROM USERS WHERE ID = ?', [req.params.id]);
    if ((users as any[]).length === 0) {
      return res.status(404).json({ message: 'USER not found' });
    }

    const user = (users as any[])[0];

    let borrowedBooks: string[] = [];
    if (user.BORROWED_BOOKS) {
      const borrowedBookIds = user.BORROWED_BOOKS.split(',');
      if (borrowedBookIds.length > 0) {
        const [books] = await connection.execute(
          `SELECT ID, NAME FROM BOOKS WHERE ID IN (${borrowedBookIds.map(() => '?').join(',')})`,
          borrowedBookIds
        );
        borrowedBooks = (books as any[]).map(book => book.NAME);
      }
    }

    let returnedBooks: string[] = [];
    if (user.RETURNED_BOOKS) {
      const returnedBookIds = user.RETURNED_BOOKS.split(',');
      if (returnedBookIds.length > 0) {
        const [books] = await connection.execute(
          `SELECT ID, NAME FROM BOOKS WHERE ID IN (${returnedBookIds.map(() => '?').join(',')})`,
          returnedBookIds
        );
        returnedBooks = (books as any[]).map(book => book.NAME);
      }
    }

    res.json({ID: user.ID, NAME: user.NAME, BORROWED_BOOKS: borrowedBooks, RETURNED_BOOKS: returnedBooks});
  } catch (error) {
    next(error);
  }
});

// Create a book
app.post('/books', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await createBookSchema.validateAsync(req.body);
    const connection = await connectDB();
    const bookName = req.body.name;
    const [result] = await connection.execute('INSERT INTO BOOKS (NAME, SCORES) VALUES (?, ?)', [
      bookName,
      JSON.stringify([])
    ]);
    res.status(201).json({id: (result as any).insertId, name: bookName});
  } catch (error) {
    next(error);
  }
});

// Get all books
app.get('/books', async (req: Request, res: Response) => {
  const connection = await connectDB();
  const [books] = await connection.execute('SELECT ID, NAME FROM BOOKS');
  res.json(books);
});

// Borrow a book
app.post('/users/:userId/borrow/:bookId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await borrowBookSchema.validateAsync(req.params);
    const connection = await connectDB();
    const [users] = await connection.execute('SELECT * FROM USERS WHERE ID = ?', [req.params.userId]);
    const [books] = await connection.execute('SELECT * FROM BOOKS WHERE ID = ?', [req.params.bookId]);

    if ((users as any[]).length === 0 || (books as any[]).length === 0) {
      return res.status(404).json({ message: 'USER or BOOK not found' });
    }

    let user = (users as any[])[0];
    let borrowedBooks = user.BORROWED_BOOKS ? user.BORROWED_BOOKS.split(',') : [];

    if (borrowedBooks.includes(req.params.bookId)) {
      return res.status(400).json({message: 'Book already borrowed by the user'});
    }

    borrowedBooks.push(req.params.bookId);
    await connection.execute('UPDATE USERS SET BORROWED_BOOKS = ? WHERE ID = ?', [
      borrowedBooks.join(','), req.params.userId
    ]);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Return a book
app.post('/users/:userId/return/:bookId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await returnBookSchema.validateAsync({ ...req.params, ...req.body });
    const connection = await connectDB();
    const [users] = await connection.execute('SELECT * FROM USERS WHERE ID = ?', [req.params.userId]);
    const [books] = await connection.execute('SELECT * FROM BOOKS WHERE ID = ?', [req.params.bookId]);

    if ((users as any[]).length === 0 || (books as any[]).length === 0) {
      return res.status(404).json({message: 'USER or BOOK not found'});
    }

    let user = (users as any[])[0];
    let book = (books as any[])[0];
    let borrowedBooks = user.BORROWED_BOOKS ? user.BORROWED_BOOKS.split(',') : [];
    let returnedBooks = user.RETURNED_BOOKS ? user.RETURNED_BOOKS.split(',') : [];

    if (!borrowedBooks.includes(req.params.bookId)) {
      return res.status(400).json({message: 'Book not borrowed by the user'});
    }

    borrowedBooks = borrowedBooks.filter((id: string) => id !== req.params.bookId);
    returnedBooks.push(req.params.bookId);
    await connection.execute('UPDATE USERS SET BORROWED_BOOKS = ?, RETURNED_BOOKS = ? WHERE ID = ?', [
      borrowedBooks.join(','), returnedBooks.join(','), req.params.userId
    ]);

    let scores: number[] = [];
    try {
      if (book.SCORES.startsWith('[')) {
        scores = JSON.parse(book.SCORES);
      } else {
        scores = book.SCORES ? book.SCORES.split(',').map((score: string) => parseFloat(score)) : [];
      }
    } catch (e) {
      console.error("Error parsing scores:", e);
      scores = [];
    }

    const score = req.body.score !== undefined ? req.body.score : null;
    if (score !== null) {
      scores.push(score);
    }

    await connection.execute('UPDATE BOOKS SET SCORES = ? WHERE ID = ?', [
      scores.join(','), req.params.bookId
    ]);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Get a book
app.get('/books/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connection = await connectDB();
    const [books] = await connection.execute('SELECT * FROM BOOKS WHERE ID = ?', [req.params.id]);

    if ((books as any[]).length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    let book = (books as any[])[0];
    let scores: number[] = [];
    try {
      if (book.SCORES.startsWith('[')) {
        scores = JSON.parse(book.SCORES);
      } else {
        scores = book.SCORES.split(',').map((score: string) => parseFloat(score));
      }
    } catch (e) {
      console.error("Error parsing scores:", e);
      scores = [];
    }

    // Calculate the average rating
    const averageRating = scores.length > 0 ? scores.reduce((sum, rating) => sum + rating, 0) / scores.length : null;

    res.json({ name: book.NAME, averageRating: averageRating !== null ? averageRating.toFixed(1) : "No ratings." });
  } catch (error) {
    next(error);
  }
});

// Global error handler for validations
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.isJoi) {
    return res.status(400).json({
      error: err.details[0].message
    });
  }

  res.status(500).json({
    error: 'An unexpected error occurred.'
  });
});

// Start the server
app.listen(port, () => {
  console.log('Server is listening at http://127.0.0.1:' + port);
});
