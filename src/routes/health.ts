import { Router } from "express";
const router = Router();
router.get("/", (_req, res) => {
  res.json({ status: "ok", service: "zkp-private-pay-api", ts: Date.now() });
});
export default router;
