import { redirect } from "next/navigation";

// route back to the home page which is the library
export default function Library() {
  redirect("/");
}