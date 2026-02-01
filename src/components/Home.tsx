/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef, useEffect } from "react";
import type EditorJS from "@editorjs/editorjs";
import { motion } from "framer-motion";
import { Trash2, Eye, EyeOff, Upload, Send, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Papa from "papaparse";
import AppPasswordInfo from './AppPasswordInfo';

interface Recipient {
  name: string;
  email: string;
}

export default function EmailCampaignTool() {
  const [recipients, setRecipients] = useState<Recipient[]>([
    { name: "", email: "" },
  ]);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderPassword, setSenderPassword] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailProvider, setEmailProvider] = useState<
    "gmail" | "outlook" | "improvemx" | "resend"
  >(
    "improvemx"
  );
  const [progress, setProgress] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [failedEmails, setFailedEmails] = useState<string[]>([]);
  const [useGreeting, setUseGreeting] = useState(false);
  const [activeTab, setActiveTab] = useState("compose");
  const [senderEmailHistory, setSenderEmailHistory] = useState<string[]>([]);
  const [subjectHistory, setSubjectHistory] = useState<string[]>([]);
  const [recipientNameHistory, setRecipientNameHistory] = useState<string[]>([]);
  const [recipientEmailHistory, setRecipientEmailHistory] = useState<string[]>([]);
  const [sendStatusList, setSendStatusList] = useState<
    { email: string; status: "success" | "error" }[]
  >([]);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const CREDENTIALS_KEY = "email_campaign_credentials";

  const editorRef = useRef<EditorJS | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(CREDENTIALS_KEY);
    if (saved) {
      try {
        const { email, password, provider, remember } = JSON.parse(saved);
        if (remember) {
          setSenderEmail(email || "");
          setSenderPassword(password || "");
          setEmailProvider(provider || "improvemx");
          setRememberMe(true);
        }
      } catch (e) {
        console.error("Failed to parse credentials", e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (rememberMe) {
        localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({
            email: senderEmail,
            password: senderPassword,
            provider: emailProvider,
            remember: true
        }));
    } else {
        localStorage.removeItem(CREDENTIALS_KEY);
    }
  }, [senderEmail, senderPassword, emailProvider, rememberMe, isLoaded]);

  const HISTORY_LIMIT = 10;
  const HISTORY_KEYS = {
    senderEmail: "history:senderEmail",
    subject: "history:subject",
    recipientName: "history:recipientName",
    recipientEmail: "history:recipientEmail",
  } as const;

  const readHistory = (key: string) => {
    if (typeof window === "undefined") return [] as string[];
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((value) => typeof value === "string")
        : [];
    } catch {
      return [];
    }
  };

  const writeHistory = (key: string, values: string[]) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(values));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  };

  const pushHistory = (
    key: string,
    value: string,
    setHistory: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const lower = trimmed.toLowerCase();
      const next = [trimmed, ...prev.filter((item) => item.toLowerCase() !== lower)].slice(
        0,
        HISTORY_LIMIT
      );
      writeHistory(key, next);
      return next;
    });
  };

  const initializeEditor = async () => {
    const EditorJS = (await import("@editorjs/editorjs")).default;
    const Header = (await import("@editorjs/header")).default;
    const List = (await import("@editorjs/list")).default;
    const Checklist = (await import("@editorjs/checklist")).default;
    const Quote = (await import("@editorjs/quote")).default;
    const CodeTool = (await import("@editorjs/code")).default;
    const InlineCode = (await import("@editorjs/inline-code")).default;
    const Marker = (await import("@editorjs/marker")).default;
    const Underline = (await import("@editorjs/underline")).default;
    const ImageTool = (await import("@editorjs/image")).default;

    if (editorRef.current) {
      await editorRef.current.isReady;
      editorRef.current.destroy();
      editorRef.current = null;
    }

    const editor = new EditorJS({
      holder: "editorjs",
      autofocus: true,
      data: text ? JSON.parse(text) : undefined,
      tools: {
        header: Header,
        list: List,
        checklist: Checklist,
        quote: Quote,
        code: CodeTool,
        inlineCode: InlineCode,
        marker: Marker,
        underline: Underline,
        image: {
          class: ImageTool,
          config: {
            uploader: {
              uploadByFile(file: File) {
                return new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    resolve({
                      success: 1,
                      file: {
                        url: e.target?.result,
                      },
                    });
                  };
                  reader.readAsDataURL(file);
                });
              },
            },
          },
        },
      },
      onChange: async () => {
        const content = await editor.save();
        setText(JSON.stringify(content));
      },
    });

    editorRef.current = editor;
  };

  useEffect(() => {
    initializeEditor();

    return () => {
      if (editorRef.current && editorRef.current.destroy) {
        editorRef.current.destroy();
      }
      editorRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSenderEmailHistory(readHistory(HISTORY_KEYS.senderEmail));
    setSubjectHistory(readHistory(HISTORY_KEYS.subject));
    setRecipientNameHistory(readHistory(HISTORY_KEYS.recipientName));
    setRecipientEmailHistory(readHistory(HISTORY_KEYS.recipientEmail));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "compose") {
      initializeEditor();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleRecipientChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newRecipients = [...recipients];
    newRecipients[index][e.target.name as keyof Recipient] = e.target.value;
    setRecipients(newRecipients);
  };

  const addRecipient = () => {
    setRecipients([...recipients, { name: "", email: "" }]);
  };

  const removeRecipient = (index: number) => {
    const newRecipients = recipients.filter((_, i) => i !== index);
    setRecipients(newRecipients);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        parseCSV(text);
      };
      reader.readAsText(file);
    }
  };

  const parseCSV = (text: string) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const newRecipients: Recipient[] = results.data
          .map((row: any) => ({
            name: row.name || "",
            email: row.email || "",
          }))
          .filter((recipient: Recipient) => recipient.email);

        setRecipients((prev) => [...prev, ...newRecipients]);
        toast.success(`${newRecipients.length} recipients added.`);
      },
      error: function (error: any) {
        console.error("Error parsing CSV:", error);
        toast.error("There was an error parsing the CSV file.");
      },
    });
  };

  const resetForm = () => {
    setSenderEmail("");
    setSenderPassword("");
    setSubject("");
    setText("");
    setRecipients([{ name: "", email: "" }]);
    setProgress(0);
    setSentCount(0);
    setFailedCount(0);
    setTotalCount(0);
    setFailedEmails([]);
    setSendStatusList([]);
    editorRef.current?.clear();
  };

  const sendEmails = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSending(true);

    setProgress(0);
    setSentCount(0);
    setFailedCount(0);
    setFailedEmails([]);
    setTotalCount(recipients.length);
    setSendStatusList([]);

    try {
      const trimmedSenderEmail = senderEmail.trim();
      const trimmedSenderPassword = senderPassword.trim();
      if (!trimmedSenderEmail) {
        throw new Error("Enter your sender email to send.");
      }
      if (!trimmedSenderPassword) {
        throw new Error(
          emailProvider === "resend"
            ? "Enter your Resend API Key."
            : "Enter your SMTP username and password to send."
        );
      }

      const response = await fetch("/api/sendEmails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          senderEmail: trimmedSenderEmail,
          senderPassword: trimmedSenderPassword,
          recipients,
          subject,
          text,
          emailProvider,
          useGreeting,
        }),
      });

      if (!response.ok) {
        let serverMessage = response.statusText;
        try {
          const data = await response.json();
          serverMessage = data?.error || data?.message || serverMessage;
        } catch {
          // ignore JSON parse failures
        }
        throw new Error(serverMessage || `Request failed (${response.status})`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((line) => line.trim() !== "");
          lines.forEach((line) => {
            try {
              const data = JSON.parse(line);
              if (data.status === "success") {
                setSentCount((prev) => prev + 1);
                setSendStatusList((prev) => {
                  const next = [...prev];
                  const existingIndex = next.findIndex(
                    (item) => item.email === data.email
                  );
                  const entry = { email: data.email, status: "success" as const };
                  if (existingIndex >= 0) {
                    next[existingIndex] = entry;
                  } else {
                    next.push(entry);
                  }
                  return next;
                });
                toast.success(`Email sent to ${data.email}`);
              } else if (data.status === "error") {
                setFailedCount((prev) => prev + 1);
                setFailedEmails((prev) => [...prev, data.email]);
                setSendStatusList((prev) => {
                  const next = [...prev];
                  const existingIndex = next.findIndex(
                    (item) => item.email === data.email
                  );
                  const entry = { email: data.email, status: "error" as const };
                  if (existingIndex >= 0) {
                    next[existingIndex] = entry;
                  } else {
                    next.push(entry);
                  }
                  return next;
                });
                toast.error(`Failed to send to ${data.email}: ${data.error}`);
              } else if (data.status === "complete") {
                setProgress(100);
                pushHistory(HISTORY_KEYS.senderEmail, trimmedSenderEmail, setSenderEmailHistory);
                pushHistory(HISTORY_KEYS.subject, subject, setSubjectHistory);
                recipients.forEach((recipient) => {
                  pushHistory(HISTORY_KEYS.recipientName, recipient.name, setRecipientNameHistory);
                  pushHistory(HISTORY_KEYS.recipientEmail, recipient.email, setRecipientEmailHistory);
                });
                toast.success(
                  `Sent ${data.sent} emails successfully. Failed: ${data.failed}`
                );
                if (data.failed > 0) {
                  toast.error(
                    `Failed to send emails to: ${data.failedEmails.join(", ")}`
                  );
                }
              }

              if (typeof data.sent === "number" && typeof data.total === "number") {
                setProgress(data.total > 0 ? (data.sent / data.total) * 100 : 100);
              } else if (
                typeof data.sent === "number" &&
                typeof data.failed === "number" &&
                totalCount > 0
              ) {
                setProgress(((data.sent + data.failed) / totalCount) * 100);
              }
            } catch (err) {
              console.error("Error parsing line:", err);
            }
          });
        }
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">
            Email Campaign Tool
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form id="emailCampaignForm" onSubmit={sendEmails} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="compose">Compose</TabsTrigger>
                <TabsTrigger value="recipients">Recipients</TabsTrigger>
              </TabsList>
              <TabsContent value="compose" className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="senderEmail">Your Email</Label>
                    <Input
                      id="senderEmail"
                      name="senderEmail"
                      type="email"
                      placeholder={
                        emailProvider === "improvemx"
                          ? "career@yourdomain.com (alias)"
                          : emailProvider === "resend"
                          ? "verified@yourdomain.com"
                          : "Enter your email"
                      }
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      required
                      autoComplete="username"
                      list="senderEmailHistory"
                    />
                    {emailProvider === "improvemx" && (
                      <p className="text-xs text-muted-foreground">
                        For ImprovMX, use your <strong>alias</strong> as the SMTP
                        username.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senderPassword">
                      {emailProvider === "resend" ? "Resend API Key" : "App Password"}
                    </Label>
                    <div className="relative">
                      <Input
                        id="senderPassword"
                        name="senderPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder={
                          emailProvider === "improvemx"
                            ? "Enter your SMTP password"
                            : emailProvider === "resend"
                            ? "Enter Resend API Key (re_...)"
                            : "Enter your app password"
                        }
                        value={senderPassword}
                        onChange={(e) => setSenderPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="rememberMe"
                        checked={rememberMe}
                        onCheckedChange={(checked) =>
                          setRememberMe(checked as boolean)
                        }
                      />
                      <Label htmlFor="rememberMe" className="text-sm text-muted-foreground font-normal">
                        Remember details for next time
                      </Label>
                    </div>
                  </div>
                </div>
                <AppPasswordInfo emailProvider={emailProvider} />
                <div className="space-y-2">
                  <Label htmlFor="emailProvider">Email Provider</Label>
                  <RadioGroup
                    id="emailProvider"
                    value={emailProvider}
                    onValueChange={(value) =>
                      setEmailProvider(value as "gmail" | "outlook" | "improvemx" | "resend")
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="gmail" id="gmail" />
                      <Label htmlFor="gmail">Gmail</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="outlook" id="outlook" />
                      <Label htmlFor="outlook">Outlook</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="improvemx" id="improvemx" />
                      <Label htmlFor="improvemx">ImprovMX</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="resend" id="resend" />
                      <Label htmlFor="resend">Resend</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    placeholder="Enter email subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    autoComplete="on"
                    list="subjectHistory"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editorjs">Email Content</Label>
                  <div
                    id="editorjs"
                    className="border p-2 rounded-md min-h-[200px]"
                  ></div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useGreeting"
                    checked={useGreeting}
                    onCheckedChange={(checked) =>
                      setUseGreeting(checked as boolean)
                    }
                  />
                  <Label htmlFor="useGreeting">
                    Start email with &quot;Dear [Recipient&apos;s Name]&quot;
                  </Label>
                </div>
              </TabsContent>
              <TabsContent value="recipients" className="space-y-6">
                <div className="space-y-4">
                  {recipients.map((recipient, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex space-x-2"
                    >
                      <Label htmlFor={`recipient-name-${index}`} className="sr-only">
                        Recipient Name
                      </Label>
                      <Input
                        id={`recipient-name-${index}`}
                        type="text"
                        name="name"
                        placeholder="Recipient Name"
                        value={recipient.name}
                        onChange={(e) => handleRecipientChange(index, e)}
                        required
                        autoComplete="name"
                        list="recipientNameHistory"
                      />
                      <Label htmlFor={`recipient-email-${index}`} className="sr-only">
                        Recipient Email
                      </Label>
                      <Input
                        id={`recipient-email-${index}`}
                        type="email"
                        name="email"
                        placeholder="Recipient Email"
                        value={recipient.email}
                        onChange={(e) => handleRecipientChange(index, e)}
                        required
                        autoComplete="email"
                        list="recipientEmailHistory"
                      />
                      {recipients.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeRecipient(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addRecipient}
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Recipient
                  </Button>
                  <div className="relative flex-1">
                    <Label htmlFor="csvUpload" className="sr-only">
                      Import CSV
                    </Label>
                    <Input
                      id="csvUpload"
                      name="csvUpload"
                      type="file"
                      accept=".csv"
                      onChange={handleCSVUpload}
                      className="cursor-pointer opacity-0 absolute inset-0 w-full h-full"
                    />
                    <Button variant="outline" className="w-full">
                      <Upload className="h-4 w-4 mr-2" /> Import CSV
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </form>
          <datalist id="senderEmailHistory">
            {senderEmailHistory.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <datalist id="subjectHistory">
            {subjectHistory.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <datalist id="recipientNameHistory">
            {recipientNameHistory.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <datalist id="recipientEmailHistory">
            {recipientEmailHistory.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          {(isSending || sendStatusList.length > 0) && (
            <div className="w-full space-y-2">
              <Progress value={progress} className="w-full" />
              <div className="text-sm text-muted-foreground text-center">
                Sent: {sentCount} | Failed: {failedCount} | Total: {totalCount}
              </div>
              {sendStatusList.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {sendStatusList.map((item) => (
                    <li key={item.email} className="flex items-center gap-2">
                      {item.status === "success" ? (
                        <Check className="h-4 w-4 text-blue-600" />
                      ) : (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                      <span className="break-all">{item.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              form="emailCampaignForm"
              className="w-full"
              disabled={isSending}
            >
              {isSending ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"
                />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {isSending ? "Sending..." : "Send Campaign"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isSending}
              onClick={resetForm}
            >
              Reset
            </Button>
          </div>
        </CardFooter>
      </Card>
      <ToastContainer position="bottom-right" />
    </div>
  );
}
