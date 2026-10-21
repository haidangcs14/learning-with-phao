"""Giữ lại để tương thích; dùng scripts.seed_all."""
from scripts.seed_all import main

if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
