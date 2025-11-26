import { Router } from "express";
import PlanController from "./plans-controller";

const router = Router();

router.get("/list", PlanController.listPlans);
router.get("/list-with-annual", PlanController.listPlansWithAnnualOptions);
router.get("/pricing-config", PlanController.getPricingConfig);
router.get("/:id", PlanController.getPlanById);

export default router;
