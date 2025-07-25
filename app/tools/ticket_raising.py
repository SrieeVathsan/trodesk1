from app.models.models import MentionPost, Ticket
from sqlalchemy import select, case, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logger import app_logger as logger


async def raise_the_ticket(db: AsyncSession) -> dict:
    try:
        ticket_result = await db.execute(select(MentionPost).where(MentionPost.sentiment=="negative", MentionPost.Ticket_resolved==False))
        tickets = ticket_result.scalars().all()
        if not tickets:
            logger.info("No tickets to raise")
            return {"tickets": [], "status": "No negative mentions found to raise tickets"}
        
        created_tickets = []
        for ticket in tickets:
            new_ticket = Ticket(
                id=f"TICKET_{ticket.id}_{int(ticket.created_at.timestamp())}",  # Generate unique ticket ID
                mention_post_id=ticket.id,
                user_id=ticket.user_id,
                platform_id=ticket.platform_id,
                created_at=ticket.created_at
            )
            db.add(new_ticket)
            
            # Mark the mention as having a ticket resolved
            ticket.Ticket_resolved = True
            
            created_tickets.append({
                "ticket_id": new_ticket.id,
                "mention_id": ticket.id,
                "platform": ticket.platform_id,
                "user_id": ticket.user_id
            })
            
            logger.info(f"Ticket raised for mention {ticket.id} on platform {ticket.platform_id}")
        
        # Commit all changes at once
        await db.commit()
        
        return {
            "tickets": created_tickets,
            "status": f"Successfully created {len(created_tickets)} ticket(s)",
            "count": len(created_tickets)
        }
    except Exception as e:
        await db.rollback()  # Rollback on error
        logger.error(f"Error in raise_the_ticket: {e}")
        return {"tickets": [], "status": f"error: {str(e)}"}