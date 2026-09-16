import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Home, Search, Phone } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-3 sm:p-4 md:p-6">
      <div className="max-w-2xl w-full space-y-6">
        {/* Main Error Card */}
        <Card className="border-destructive/50">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4 sm:p-6">
                <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl sm:text-3xl md:text-4xl font-bold">
                Order Not Found
              </CardTitle>
              <CardDescription className="text-sm sm:text-base mt-2">
                We couldn't locate the order you're looking for
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Error Details */}
            <div className="bg-muted/50 rounded-lg p-4 sm:p-5 space-y-3">
              <h3 className="font-semibold text-sm sm:text-base flex items-center gap-2">
                <Search className="h-4 w-4" />
                Possible Reasons
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>The order number may be incorrect or mistyped</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>The order may have been cancelled or deleted</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>The URL link might be broken or expired</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>This order may not exist in our system</span>
                </li>
              </ul>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="w-full sm:flex-1" size="lg">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Return to Home
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:flex-1" size="lg">
                <a href="tel:+917770008880">
                  <Phone className="mr-2 h-4 w-4" />
                  Contact Support
                </a>
              </Button>
            </div>

            {/* Help Text */}
            <div className="text-center pt-2">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Need help? Contact us at{' '}
                <a
                  href="mailto:info@kalapurna.in"
                  className="text-primary hover:underline font-medium"
                >
                  info@kalapurna.in
                </a>
                {' '}or call{' '}
                <a
                  href="tel:+917770008880"
                  className="text-primary hover:underline font-medium"
                >
                  +91-7770008880
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info Card */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="text-xs sm:text-sm text-muted-foreground">
                <strong>Tip:</strong> Order numbers usually look like this: <code className="bg-background px-2 py-1 rounded text-primary font-mono">ORD-1762607906831</code>
              </p>
              <p className="text-xs text-muted-foreground">
                You can find your order number in the confirmation email we sent you.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
