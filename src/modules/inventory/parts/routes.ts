import { Router } from "express";
import PartsController from "./parts-controller";
import { authMiddleware } from "../../../core/middleware/auth-middleware";
import { requirePermission } from "../../../core/middleware/permission-middleware";
import { Permission } from "../../plans/permission-entity";

const router = Router();

router.post("/list", authMiddleware, PartsController.listParts);
router.post("/get", authMiddleware, PartsController.getPart);
router.post("/create", authMiddleware, requirePermission(Permission.PART_CREATE), PartsController.createPart);
router.post("/edit", authMiddleware, requirePermission(Permission.PART_EDIT), PartsController.editPart);
router.post("/remove", authMiddleware, requirePermission(Permission.PART_DELETE), PartsController.removePart);

router.get("/:id/stock", authMiddleware, PartsController.getPartStock);
router.post("/check-availability", authMiddleware, PartsController.checkAvailability);

export default router;
