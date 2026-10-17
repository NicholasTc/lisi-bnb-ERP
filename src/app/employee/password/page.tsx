import {PasswordChange} from "@/components/password-change";
import Link from "next/link";
export default function PasswordPage(){return <main className="mx-auto max-w-md px-6 py-12"><Link className="underline" href="/employee/sign-in">Employee access</Link><PasswordChange/></main>;}
