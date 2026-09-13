"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { AppLayout } from "@/components/dashboard/app-layout"
import { createBrowserClient } from "@/lib/supabase/client"
import { useStudyStore } from "@/lib/store/study-store"
import {
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  CreditCard,
  LogOut,
  Trash2,
  Moon,
  Sun,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  ExternalLink,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import Link from "next/link"
import { SyllabusPicker } from "@/components/settings/syllabus-picker"

interface Subscription {
  plan_type: string
  status: string
  current_period_end: string | null
}

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [userEmail, setUserEmail] = useState("")
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [notifications, setNotifications] = useState({
    email: true,
    studyReminders: true,
    weeklyReport: false,
  })
  const [isDeleting, setIsDeleting] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isManagingSubscription, setIsManagingSubscription] = useState(false)

  // Email update state
  const [newEmail, setNewEmail] = useState("")
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [emailSent, setEmailSent] = useState(false)

  const { theme, toggleTheme } = useStudyStore()
  const supabase = createBrowserClient()
  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }

      setUserEmail(user.email || "")

      // Fetch subscription
      const { data: subData, error: subError } = await supabase
        .from("subscriptions")
        .select("plan_type, status, current_period_end")
        .eq("user_id", user.id)
        .single()

      if (subData) {
        setSubscription(subData)
      }

      setIsLoading(false)
    }

    fetchData()
  }, [supabase, router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const handleManageSubscription = async () => {
    setIsManagingSubscription(true)
    try {
      const response = await fetch("/api/subscription/billing-portal", {
        method: "POST",
      })

      console.log("[v0] Billing portal response status:", response.status)

      const data = await response.json()
      console.log("[v0] Billing portal response data:", data)

      if (!response.ok) {
        console.error("[v0] Billing portal error response:", data)
        alert(data.error || "Failed to open billing portal. Please try again.")
        return
      }

      if (data.url) {
        console.log("[v0] Redirecting to billing portal:", data.url)
        window.location.href = data.url
      } else {
        console.error("[v0] No URL in response:", data)
        alert("Failed to open billing portal. No redirect URL received.")
      }
    } catch (error) {
      console.error("[v0] Error opening billing portal:", error)
      alert("Failed to open billing portal. Please try again.")
    } finally {
      setIsManagingSubscription(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError("")

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      return
    }

    setIsChangingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      setPasswordSaved(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")

      setTimeout(() => setPasswordSaved(false), 3000)
    } catch (error: any) {
      setPasswordError(error.message || "Failed to update password")
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleChangeEmail = async () => {
    setEmailError("")
    if (!newEmail.trim()) {
      setEmailError("Please enter a new email address")
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      setEmailError("Please enter a valid email address")
      return
    }
    if (newEmail === userEmail) {
      setEmailError("New email must be different from your current email")
      return
    }
    setIsChangingEmail(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail })
      if (error) throw error
      setEmailSent(true)
      setIsEditingEmail(false)
      setNewEmail("")
    } catch (error: any) {
      setEmailError(error.message || "Failed to update email")
    } finally {
      setIsChangingEmail(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    // In production, this would call an API to delete the user's account
    // For now, we'll just sign out
    await supabase.auth.signOut()
    router.push("/")
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    )
  }

  const isGenius = subscription?.plan_type === "genius"

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account preferences</p>
          </div>
        </div>

        {/* Account Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account
            </CardTitle>
            <CardDescription>Your account information and profile settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              {emailSent ? (
                <div className="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Confirmation email sent</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Check your new email inbox and click the link to confirm the change.
                    </p>
                  </div>
                </div>
              ) : isEditingEmail ? (
                <div className="space-y-2">
                  <Input value={userEmail} disabled className="bg-muted text-muted-foreground" />
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => { setNewEmail(e.target.value); setEmailError("") }}
                    placeholder="Enter new email address"
                    autoFocus
                  />
                  {emailError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {emailError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleChangeEmail} disabled={isChangingEmail || !newEmail.trim()}>
                      {isChangingEmail ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                      Save New Email
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setIsEditingEmail(false); setNewEmail(""); setEmailError("") }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input value={userEmail} disabled className="bg-muted" />
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => setIsEditingEmail(true)}>
                    Change
                  </Button>
                </div>
              )}
              {!isEditingEmail && !emailSent && (
                <p className="text-xs text-muted-foreground">A confirmation link will be sent to your new email.</p>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Profile Settings</p>
                <p className="text-sm text-muted-foreground">Update your display name and bio</p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/profile">
                  Edit Profile
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Syllabus Section */}
        <SyllabusPicker />

        {/* Subscription Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </CardTitle>
            <CardDescription>Manage your subscription and billing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                {isGenius ? (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{isGenius ? "Genius Plan" : "Free Plan"}</p>
                    {isGenius && (
                      <Badge
                        className={`${subscription?.status === "canceling" ? "bg-orange-500" : "bg-gradient-to-r from-yellow-400 to-orange-500"} text-white`}
                      >
                        {subscription?.status === "canceling" ? "Canceling" : "Active"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isGenius && subscription?.current_period_end
                      ? subscription?.status === "canceling"
                        ? `Access until ${new Date(subscription.current_period_end).toLocaleDateString()}`
                        : `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                      : "Upgrade to unlock all features"}
                  </p>
                </div>
              </div>
              {isGenius ? (
                <Button variant="outline" onClick={handleManageSubscription} disabled={isManagingSubscription}>
                  {isManagingSubscription ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Manage
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/upgrade">Upgrade</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>Customize how QuillGlow looks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                <div>
                  <p className="font-medium">Dark Mode</p>
                  <p className="text-sm text-muted-foreground">
                    {theme === "dark" ? "Currently using dark theme" : "Currently using light theme"}
                  </p>
                </div>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
            </div>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Choose what notifications you receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive updates via email</p>
              </div>
              <Switch
                checked={notifications.email}
                onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Study Reminders</p>
                <p className="text-sm text-muted-foreground">Get reminded to study</p>
              </div>
              <Switch
                checked={notifications.studyReminders}
                onCheckedChange={(checked) => setNotifications({ ...notifications, studyReminders: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Weekly Progress Report</p>
                <p className="text-sm text-muted-foreground">Receive weekly study summary</p>
              </div>
              <Switch
                checked={notifications.weeklyReport}
                onCheckedChange={(checked) => setNotifications({ ...notifications, weeklyReport: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>Manage your password and security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>

              {passwordError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {passwordError}
                </p>
              )}

              {passwordSaved && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Password updated successfully
                </p>
              )}

              <Button onClick={handleChangePassword} disabled={isChangingPassword || !newPassword || !confirmPassword}>
                {isChangingPassword ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Update Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>Irreversible actions for your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sign Out</p>
                <p className="text-sm text-muted-foreground">Sign out of your account on this device</p>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-destructive">Delete Account</p>
                <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your account and remove all your data
                      including notes, flashcards, and study plans.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
