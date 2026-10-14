import Link from "next/link";
export default function Home() {
  return <main className="mx-auto max-w-xl px-6 py-20">
    <h1 className="text-3xl font-bold">LISI BNB ERP</h1>
    <p className="mt-4 text-lg">Café employee access</p>
    <Link className="mt-8 inline-block rounded-md bg-[#17304b] px-6 py-3 text-white" href="/employee/sign-in">Employee sign in</Link>
  </main>;
}
