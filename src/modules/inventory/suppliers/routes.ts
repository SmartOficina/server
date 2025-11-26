import { Router } from "express";
import SuppliersController from "./suppliers-controller";
import { authMiddleware } from "../../../core/middleware/auth-middleware";
import { requirePermission } from "../../../core/middleware/permission-middleware";
import { Permission } from "../../plans/permission-entity";

const router = Router();

router.post("/list", authMiddleware, SuppliersController.listSuppliers);
router.post("/get", authMiddleware, SuppliersController.getSupplier);
router.post("/create", authMiddleware, requirePermission(Permission.SUPPLIER_CREATE), SuppliersController.createSupplier);
router.post("/edit", authMiddleware, requirePermission(Permission.SUPPLIER_EDIT), SuppliersController.editSupplier);
router.post("/remove", authMiddleware, requirePermission(Permission.SUPPLIER_DELETE), SuppliersController.removeSupplier);

export default router;
