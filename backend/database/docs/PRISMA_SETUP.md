# Prisma Setup Instructions

This project now uses **Prisma ORM** instead of SQLAlchemy for database management.

## Prerequisites

You need Node.js and npm installed (for Prisma CLI):
```bash
# Install Node.js from https://nodejs.org/
# Verify installation:
node --version
npm --version
```

## Setup Steps

### 1. Install Prisma CLI

```bash
npm install -g prisma
# or
npm install --save-dev prisma
```

### 2. Create Initial Migration

```bash
# From the project root directory
prisma migrate dev --name init
```

This will:
- Create the Prisma client Python package
- Run migrations against your PostgreSQL database
- Generate type definitions

### 3. Generate Prisma Types

```bash
prisma generate
```

This creates Prisma Python client files that will be imported in your code.

## Database Configuration

The database URL is configured via environment variables in `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/document_processor"
```

Prisma will automatically use this URL for all database operations.

## Running Migrations in Production

```bash
# Deploy migrations to production database
prisma migrate deploy

# Create a new migration (after schema.prisma changes)
prisma migrate dev --name <migration_name>

# View migration status
prisma migrate status
```

## Seeding the Database

To seed initial data (users, test data), create `prisma/seed.py`:

```python
from prisma import Prisma

async def main():
    prisma = Prisma()
    await prisma.connect()
    
    # Create test user
    user = await prisma.user.create(
        data={
            "user_id": "user_123",
            "email": "test@example.com",
            "password": "hashed_password",
            "is_active": True,
        }
    )
    print(f"Created user: {user.email}")
    
    await prisma.disconnect()

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

Run with:
```bash
python prisma/seed.py
```

## Viewing the Database

```bash
# Open Prisma Studio (interactive database UI)
prisma studio

# This opens http://localhost:5555 in your browser
```

## Key Changes from SQLAlchemy

| Feature | SQLAlchemy | Prisma |
|---------|-----------|--------|
| Define Models | `models.py` with ORM classes | `prisma/schema.prisma` (Schema Language) |
| Queries | `session.query(Model)...` | `await prisma.model.find_*()` |
| Create | `session.add(); session.commit()` | `await prisma.model.create()` |
| Update | `obj.field = value; session.commit()` | `await prisma.model.update()` |
| Delete | `session.delete(); session.commit()` | `await prisma.model.delete()` |
| Transactions | `with session.begin()` | `async with prisma.batch_() as batch` |
| Type Hints | Manual | Auto-generated |
| Relationships | SQLAlchemy relations | Prisma includes/select |

## Common Prisma Commands

```bash
# View current schema
prisma db pull  # Pull schema from existing database

# Push schema to database
prisma db push

# Reset database (DELETE ALL DATA!)
prisma db reset

# Check for migration issues
prisma validate

# Format schema file
prisma format
```

## Troubleshooting

### "Module 'prisma' has no attribute 'models'"
**Solution**: Run `prisma generate` to create the Python client

### "No migration history found"
**Solution**: Run `prisma migrate dev --name init` to create migrations

### "Connection refused"
**Solution**: Ensure PostgreSQL is running and DATABASE_URL is correct

### "Foreign key constraint failed"
**Solution**: Check that parent records exist before creating children

## Documentation

- [Prisma Python Client](https://github.com/RobertCraigie/prisma-client-py)
- [Prisma Schema Reference](https://www.prisma.io/docs/concepts/components/prisma-schema)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
