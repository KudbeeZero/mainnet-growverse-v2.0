import { Router, type IRouter } from "express";
import healthRouter from "./health";
import plantRouter from "./plant";

const router: IRouter = Router();

router.use(healthRouter);
// FRONTIER Clone Room — plant lifecycle routes (additive)
router.use(plantRouter);

export default router;
