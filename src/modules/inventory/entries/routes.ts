import { Router } from "express";
import { authMiddleware } from "../../../core/middleware/auth-middleware";
import { requirePermission } from "../../../core/middleware/permission-middleware";
import { Permission } from "../../plans/permission-entity";
import InventoryEntriesController from "./entries-controller";

const router = Router();

router.get("/list", authMiddleware, InventoryEntriesController.listEntries);
router.post("/create", authMiddleware, requirePermission(Permission.INVENTORY_ENTRY_CREATE), InventoryEntriesController.createEntry);
router.post("/create-exit", authMiddleware, requirePermission(Permission.INVENTORY_ENTRY_CREATE), InventoryEntriesController.createManualExit);
router.post("/edit", authMiddleware, requirePermission(Permission.INVENTORY_ENTRY_EDIT), InventoryEntriesController.editEntry);
router.post("/remove", authMiddleware, requirePermission(Permission.INVENTORY_ENTRY_DELETE), InventoryEntriesController.removeEntry);

export default router;
