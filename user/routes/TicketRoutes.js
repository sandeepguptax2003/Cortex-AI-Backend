const express = require("express");
const TicketController = require("../controllers/TicketController");
const { authenticate } = require("../../auth/middleware/AuthMiddleware");
const { ticketLimiter } = require("../middleware/UserRateLimit");

const router = express.Router();

// All ticket routes require authentication
router.use(authenticate);
router.use(ticketLimiter);

// GET /user/tickets - Get all tickets
router.get("/tickets", TicketController.getTickets);

// GET /user/tickets/my - Get my tickets
router.get("/tickets/my", TicketController.getMyTickets);

// GET /user/tickets/overdue - Get overdue tickets
router.get("/tickets/overdue", TicketController.getOverdueTickets);

// GET /user/tickets/:ticketId - Get single ticket
router.get("/tickets/:ticketId", TicketController.getTicket);

// POST /user/tickets - Create ticket
router.post("/tickets", TicketController.createTicket);

// PATCH /user/tickets/:ticketId - Update ticket
router.patch("/tickets/:ticketId", TicketController.updateTicket);

// DELETE /user/tickets/:ticketId - Delete ticket
router.delete("/tickets/:ticketId", TicketController.deleteTicket);

// POST /user/tickets/:ticketId/comments - Add comment
router.post("/tickets/:ticketId/comments", TicketController.addComment);

module.exports = router;
