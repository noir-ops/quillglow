import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail } from "lucide-react"

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <Card className="w-full max-w-md border-2">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
          <CardDescription>
            We've sent you a verification link. Please check your email to confirm your account before signing in.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>Didn't receive the email? Check your spam folder or try signing up again.</p>
        </CardContent>
      </Card>
    </div>
  )
}
