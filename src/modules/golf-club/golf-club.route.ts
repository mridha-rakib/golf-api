import { ROLES } from "@/constants/app.constants";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { Router } from "express";
import { GolfClubController } from "./golf-club.controller";

const router = Router();
const controller = new GolfClubController();

router.use(authMiddleware.verifyToken, authMiddleware.authorize(ROLES.ADMIN));

router.post("/", controller.createGolfClub);
router.get("/golfers", controller.listGolfers);
router.post("/:clubId/manager", controller.assignManager);
router.post("/:clubId/members", controller.addMember);

export default router;
