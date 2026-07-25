import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { REVENUE_SERVICES, type RevenueServiceId } from "@/config/revenueServices";
import { initializeCheckout } from "@/lib/payments/initializeCheckout";
import { toast } from "sonner";

const formatInr = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export function RevenueServicesSection() {
  const navigate = useNavigate();
  const [paying, setPaying] = useState<RevenueServiceId | null>(null);

  const startPayment = async (serviceId: RevenueServiceId, serviceName: string) => {
    if (paying) return;
    setPaying(serviceId);
    await initializeCheckout({
      purpose: "service_order",
      payload: { serviceCode: serviceId },
      metadata: { payment_purpose: "managed_service", service_code: serviceId },
      label: serviceName,
      description: `${serviceName} — StreamVista`,
      onSuccess: (result) => {
        setPaying(null);
        const invoiceId = (result as { invoiceId?: string } | null)?.invoiceId;
        toast.success("Payment verified. Your service order is confirmed.");
        if (invoiceId) navigate(`/invoice/${invoiceId}`);
      },
      onDismiss: () => setPaying(null),
      onError: () => setPaying(null),
    });
  };

  return (
    <section id="managed-services" className="border-t bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary">StreamVista Managed Services</Badge>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            നിങ്ങളുടെ സിനിമ buyer-ready ആക്കാം
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            Metadata, rights checklist, QC coordination, screener preparation എന്നിവ structured service ആയി ലഭിക്കും.
            Secure Razorpay payment, verification, order record, GST invoice എന്നിവ payment flow-ൽ ഉൾപ്പെടുത്തിയിട്ടുണ്ട്.
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
                  <Badge>Available</Badge>
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
                <Button
                  className="w-full"
                  disabled={paying !== null}
                  onClick={() => startPayment(service.id, service.name)}
                >
                  {paying === service.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  {paying === service.id ? "Opening secure payment…" : "Pay securely with Razorpay"}
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/contact">Talk to StreamVista</Link>
                </Button>
                <p className="text-center text-xs leading-5 text-muted-foreground">
                  Successful payment കഴിഞ്ഞാൽ order confirmation ഉം GST invoice ഉം ലഭിക്കും.
                </p>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Services() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <RevenueServicesSection />
    </main>
  );
}
