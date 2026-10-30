import { redirect } from "next/navigation"
import { STORE_COMING_SOON, STORE_COMING_SOON_PATH } from "@/lib/store-status"

export default function StorePage() {
  redirect(STORE_COMING_SOON ? STORE_COMING_SOON_PATH : "/shop")
}
