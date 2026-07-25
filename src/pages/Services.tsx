import { CheckCircle2, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { REVENUE_SERVICES } from "@/config/revenueServices";

const formatInr = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function Services() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary">StreamVista Services</Badge>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
            നിങ്ങളുടെ സിനിമ buyer-ready ആക്കാം
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            Metadata, rights checklist, QC coordination, screener preparation എന്നിവ structured service ആയി ലഭിക്കും.
            Online payment safety verification പൂർത്തിയായ ശേഷം checkout തുറക്കും.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {REVENUE_SERVICES.map((service) => (
            <Card key={service.id} className="flex h-full flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl">{service.name}</CardTitle>
                    <CardDescription className="mt-2">{service.description}</CardDescription>
                  </div>
                  <Badge variant={service.enabled ? "default" : "outline"}>
                    {service.enabled ? "Available" : "Coming soon"}
                  </Badge>
                </div>
                <div className="mt-5">
                  <div className="text-3xl font-semibold">{formatInr(service.totalAmountInr)}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatInr(service.baseAmountInr)} + {service.gstRate}% GST
                  </p>
                </div>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {service.deliverables.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="flex flex-col items-stretch gap-3">
                <Button disabled={!service.enabled} className="w-full">
                  {!service.enabled && <LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />}
                  {service.enabled ? "Proceed to secure payment" : "Payment safety check in progress"}
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/contact">Talk to StreamVista</Link>
                </Button>
                <p className="text-center text-xs leading-5 text-muted-foreground">
                  Checkout live ആക്കുന്നതിന് മുമ്പ് Razorpay verification, webhook, invoice, receipt എന്നിവ test ചെയ്യും.
                </p>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
