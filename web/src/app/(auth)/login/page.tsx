"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { AlertTriangle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

// 同意按钮的最短阅读时间（秒）
const TERMS_COUNTDOWN_SECONDS = 5;

// 登录页背景装饰用的"假终端"内容。纯展示：不含真实目标，全部为示意数据。
// 终端日志用的本地时间格式 HH:MM:SS.mmm
function fmtClock(ms: number) {
  const d = new Date(ms);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

const TERMINAL_LINES: { text: string; tone?: "dim" | "cmd" | "ok" | "warn" }[] = [
  { text: "$ catty version", tone: "cmd" },
  { text: "catty 0.4.8-catty · darwin/arm64 · go1.26.4", tone: "dim" },
  { text: "$ catty --init", tone: "cmd" },
  { text: "[config]  loaded ~/.catty/config.json", tone: "dim" },
  { text: "[pg]      pool ready min=2 max=13 → 127.0.0.1:5432/artex", tone: "dim" },
  { text: "[migrate] schema up-to-date · 51 tables · rev=20261109_04", tone: "dim" },
  { text: "[auth]    jwt key loaded · HS256 · ttl=168h · kid=5f2c", tone: "dim" },
  { text: "[llm]     profile \"catty-default\" · openai-compatible · ctx=256k", tone: "dim" },
  { text: "[notify]  feishu webhook verified 412ms", tone: "ok" },
  { text: "[traffic] recording proxy 127.0.0.1:8788 · ca=data/traffic/_ca/pki", tone: "dim" },
  { text: "[engine]  workers=3 · planner=1 · scheduler=depth-first", tone: "dim" },
  { text: "[ok]      listening on 127.0.0.1:8787", tone: "ok" },
  { text: "", tone: "dim" },
  { text: "$ catty task new --name q3-web --scope 10.20.0.0/24 --goal \"obtain root\"", tone: "cmd" },
  { text: "[scope]   254 hosts · 0 exclusions · policy=strict", tone: "dim" },
  { text: "[guard]   out-of-scope confirmation: REQUIRED", tone: "warn" },
  { text: "[planner] round 1 · budget 24 intents · depth 1", tone: "dim" },
  { text: "[w#1]     intent 1  tcp-syn 22,80,443,8080,8443", tone: "dim" },
  { text: "[w#2]     intent 2  passive dns (crt.sh / otx / chaos)", tone: "dim" },
  { text: "[w#3]     intent 3  http fingerprint", tone: "dim" },
  { text: "[masscan] rate=1200pps · 254 hosts", tone: "dim" },
  { text: "[masscan] 41/41 up · 68 open ports · 3.9s", tone: "ok" },
  { text: "[httpx]   10.20.0.31  nginx/1.24.0  [200] 1.2kB  \"Intranet\"", tone: "dim" },
  { text: "[httpx]   10.20.0.77  nginx/1.18.0  [401] 0.6kB  \"Admin\"", tone: "dim" },
  { text: "[httpx]   10.20.0.12  OpenSSH_8.2p1 Ubuntu-4ubuntu0.5", tone: "dim" },
  { text: "[w#1]     intent 1 done · facts=3 assets=41", tone: "ok" },
  { text: "[w#2]     crt.sh → 6 subs (2 internal-only)", tone: "dim" },
  { text: "[scope]   REJECT legacy.partner-cdn.example — not in allowlist", tone: "warn" },
  { text: "[w#3]     intent 3 done · tech: nginx, php/8.1, jquery/1.12", tone: "ok" },
  { text: "[planner] round 2 · intents=9 · depth=2", tone: "dim" },
  { text: "[w#1]     GET /admin → 302 /login.php  set-cookie=PHPSESSID", tone: "dim" },
  { text: "[w#1]     POST /login.php · sqli probe ' or 1=1 --  → 200 (no diff)", tone: "dim" },
  { text: "[w#2]     GET /api/v1/export?file=../../etc/passwd → 403", tone: "dim" },
  { text: "[guard]   BLOCK destructive payload: DROP TABLE users", tone: "warn" },
  { text: "[w#3]     directory brute 1,842 paths · 12 hits", tone: "dim" },
  { text: "[w#3]     /backup/ 200 · 4.1MB zip", tone: "dim" },
  { text: "[w#1]     login.php error-based → 500 (stack trace leaked)", tone: "dim" },
  { text: "[finding] #12 path traversal (blocked) severity=info", tone: "dim" },
  { text: "[llm]     round=2 in=18,442 out=1,203 cached=12,288 $0.031", tone: "dim" },
  { text: "[w#2]     ssh banner 10.20.0.12 · kex diffie-hellman-group14-sha1", tone: "dim" },
  { text: "[finding] #13 openssh 8.2 weak kex severity=low", tone: "dim" },
  { text: "[planner] round 3 · coverage=0.87 · converging", tone: "dim" },
  { text: "[w#1]     /backup/db_2026.zip → 200 · 4.1MB · extracting index", tone: "dim" },
  { text: "[w#1]     archive contains 3 .sql files (schema, users, orders)", tone: "dim" },
  { text: "[finding] #14 exposed backup archive severity=high", tone: "warn" },
  { text: "[notify]  feishu → 3 findings pushed 412ms", tone: "ok" },
  { text: "[w#3]     10.20.0.77 /admin/login.php · weak password policy", tone: "dim" },
  { text: "[w#2]     internal dns resolver 10.20.0.2 · 78 PTR records", tone: "dim" },
  { text: "[scope]   78/78 in-scope · expanding allowed", tone: "dim" },
  { text: "[planner] round 4 · intents=11 · depth=3", tone: "dim" },
  { text: "[w#1]     10.20.0.140  redis:6379  no-auth  INFO server", tone: "dim" },
  { text: "[finding] #15 redis unauthenticated severity=critical", tone: "warn" },
  { text: "[w#2]     10.20.0.141  mysql:3306  handshake · 5.7.44", tone: "dim" },
  { text: "[w#3]     10.20.0.152  k8s api:6443  anonymous-auth=false", tone: "dim" },
  { text: "[w#1]     redis DBSIZE → 1,204,331 keys", tone: "dim" },
  { text: "[guard]   BLOCK FLUSHALL (destructive)", tone: "warn" },
  { text: "[llm]     round=4 in=22,190 out=1,884 cached=16,384 $0.041", tone: "dim" },
  { text: "[w#2]     10.20.0.160  jenkins:8080  [403]  anonymous denied", tone: "dim" },
  { text: "[w#3]     10.20.0.160  /script  → 403", tone: "dim" },
  { text: "[w#1]     credential replay 41/41 hosts · 0 success", tone: "dim" },
  { text: "[w#2]     tls scan · 12 hosts · 4 weak ciphers", tone: "dim" },
  { text: "[finding] #16 rc4 cipher suites severity=low", tone: "dim" },
  { text: "[planner] round 5 · coverage=0.94", tone: "dim" },
  { text: "[w#3]     10.20.0.31 /console  → 200 · spring boot actuator", tone: "dim" },
  { text: "[w#1]     /actuator/env → 200 · 42 properties", tone: "dim" },
  { text: "[finding] #17 actuator env exposure severity=high", tone: "warn" },
  { text: "[guard]   out-of-scope host 203.0.113.9 skipped (external)", tone: "warn" },
  { text: "[notify]  feishu → 5 findings pushed 388ms", tone: "ok" },
  { text: "[report]  generating · 41 assets · 6 facts · 5 findings", tone: "dim" },
  { text: "[report]  export → data/report-20261109.html (214kB)", tone: "ok" },
  { text: "[w#1]     session transcript archived (1,204 messages)", tone: "dim" },
  { text: "[llm]     total in=61,022 out=5,411 cached=44,032 $0.114", tone: "dim" },
  { text: "[engine]  task PAUSED by operator", tone: "warn" },
  { text: "[ok]      state persisted · workers idle", tone: "ok" },
  { text: "", tone: "dim" },
  { text: "$ catty status", tone: "cmd" },
  { text: "[engine]  tasks=1 running=0 paused=1 workers=3", tone: "dim" },
  { text: "[traffic] recorded=18,442 requests · proxy 127.0.0.1:8788", tone: "dim" },
  { text: "[notify]  pending=0 failed=0", tone: "dim" },
  { text: "[guard]   policy=strict · destructive blocked=2 · scope rejected=2", tone: "dim" },
  { text: "$ catty scope show", tone: "cmd" },
  { text: "[scope]   allow 10.20.0.0/24 · deny 0.0.0.0/0 · mode=explicit", tone: "dim" },
  { text: "[scope]   external assets require operator confirmation", tone: "warn" },
  { text: "$ catty findings list --severity critical", tone: "cmd" },
  { text: "[finding] #15 redis unauthenticated · 10.20.0.140:6379", tone: "warn" },
  { text: "[ok]      awaiting next authorized scope", tone: "ok" },
];

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(true); // 品牌化：登录页自动弹出免责声明
  const [readToEnd, setReadToEnd] = useState(false);
  // 每次打开弹窗重置的确认倒计时
  const [countdown, setCountdown] = useState(TERMS_COUNTDOWN_SECONDS);
  // 终端日志的基准时间与逐行时间偏移：每次循环回到开头时重新取当前时间，
  // 保证显示的始终是"刚刚发生"的时间，而不是写死的假时间戳。
  const [termEpoch, setTermEpoch] = useState(() => Date.now());
  const termOffsets = useMemo(() => {
    let acc = 0;
    return TERMINAL_LINES.map(() => (acc += 60 + Math.random() * 900));
  }, []);
  const termStart = termEpoch - termOffsets[termOffsets.length - 1];
  useEffect(() => {
    if (!termsOpen) return;
    setCountdown(TERMS_COUNTDOWN_SECONDS);
    const timer = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [termsOpen]);
  const termsBodyRef = useRef<HTMLDivElement>(null);

  // 登录页背景终端：按随机间隔逐行上移，模拟真实日志"突发到达"的节奏。
  // 不用 CSS steps()：它的时间间隔是恒定的，看起来像机械动画。
  const termRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = termRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const total = TERMINAL_LINES.length; // 单份日志的行数
    let line = 0;
    let timer = 0;
    const step = () => {
      line = (line + 1) % total; // 走满一份后回到 0：两份内容相同，跳回无痕
      if (line === 0) setTermEpoch(Date.now()); // 新一轮日志以"当前时间"起算
      el.style.transform = `translateY(-${(line * 100) / (total * 2)}%)`;
      // 18% 概率连发（90–210ms），其余 260–1160ms，节奏不均匀才像真终端
      const burst = Math.random() < 0.18;
      const delay = burst ? 90 + Math.random() * 120 : 260 + Math.random() * 900;
      timer = window.setTimeout(step, delay);
    };
    timer = window.setTimeout(step, 700);
    return () => window.clearTimeout(timer);
    // 依赖 checking：登录态检查期间组件提前 return，终端节点尚未挂载，
    // 空依赖的话 effect 只跑一次、ref 为 null，动画就永远不启动了。
  }, [checking]);

  // 滚动到条款底部（含无需滚动即可完整展示的情况）方可点击「同意」。
  function handleTermsScroll() {
    const el = termsBodyRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReadToEnd(true);
  }

  useEffect(() => {
    if (!termsOpen) return;
    // 打开时重置，并处理内容本就不足一屏、无法触发滚动的场景。
    setReadToEnd(false);
    const check = () => {
      const el = termsBodyRef.current;
      if (el && el.scrollHeight <= el.clientHeight + 8) setReadToEnd(true);
    };
    check();
    // 刚挂载时布局可能未稳定（ref 为空或高度为 0），延迟再判定一次，
    // 否则「条款不足一屏」的用户会永远等不到按钮解禁。
    const timer = setTimeout(check, 300);
    return () => clearTimeout(timer);
  }, [termsOpen]);

  useEffect(() => {
    // 已登录直接进主界面（静态导出下无 middleware 代劳这层跳转）。
    const token = auth.getToken();
    if (token) {
      // localStorage 可能仍有凭据但 cookie 已丢失。先同步，再发起全新请求，
      // 避免服务端守卫或路由缓存把跳转送回仍处于 checking 状态的登录页。
      auth.setToken(token);
      window.location.replace("/function/tasks");
      return;
    }
    api
      .authStatus()
      .then(({ initialized }) => {
        if (!initialized) router.replace("/setup");
      })
      .catch(() => setError("无法连接到后端服务"))
      .finally(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("请先阅读并同意《使用须知》");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { token } = await api.login("Catty", password);
      auth.setToken(token);
      window.location.replace("/function/tasks");
    } catch {
      setError("用户名或密码错误");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center text-muted-foreground">
        正在检查登录状态…
      </div>
    );
  }

  return (
    <div className="dark relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0a0c10] px-4 py-12">
      {/* 背景：网格 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      {/* 背景：橙色光晕 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 size-[720px] -translate-x-1/2 rounded-full bg-[#ff6a00]/20 blur-[130px]"
      />
      {/* 背景：滚动终端（纯装饰，不可选中/不可点击） */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[46%] select-none overflow-hidden border-r border-white/[0.06] xl:block"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
        }}
      >
        <div
          ref={termRef}
          className="catty-term-scroll px-8 py-6 font-mono text-[11.5px] leading-[2.05] transition-transform duration-100 ease-out"
        >
          {[0, 1].map((copy) => (
            <div key={copy}>
              {TERMINAL_LINES.map((line, i) => (
                <div
                  key={`${copy}-${i}`}
                  className={
                    line.tone === "cmd"
                      ? "text-white/45"
                      : line.tone === "ok"
                        ? "text-emerald-400/35"
                        : line.tone === "warn"
                          ? "text-[#ff9a4d]/60"
                          : "text-white/20"
                  }
                >
                  {line.tone === "cmd" || line.text === ""
                    ? line.text
                    : `${fmtClock(termStart + termOffsets[i])}  ${line.text}`}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8 shadow-[0_8px_60px_-12px_rgba(0,0,0,0.8)] backdrop-blur-sm">
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Catty" width={88} height={88} className="size-22 drop-shadow-[0_6px_20px_rgba(255,106,0,0.35)]" />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-white">登录 Catty</h2>
              <p className="text-xs text-white/45">自主渗透测试控制台 · 七猫内部使用</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-white/70">用户名</Label>
              <Input id="username" value="Catty" readOnly className="border-white/10 bg-white/[0.04] text-white/60" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-white/70">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoFocus
                autoComplete="current-password"
                className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/25"
              />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="agree-terms"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5 border-white/25"
              />
              <Label htmlFor="agree-terms" className="text-sm font-normal leading-relaxed text-white/50">
                我已阅读并同意
                <button
                  type="button"
                  onClick={() => setTermsOpen(true)}
                  className="mx-0.5 font-medium text-[#ff8a3d] underline-offset-4 hover:underline"
                >
                  《使用须知》
                </button>
              </Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !password || !agreed}>
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
        </div>
        <p className="mt-5 text-center font-mono text-[11px] text-white/25">
          catty · 仅限授权范围内的安全测试
        </p>
      </div>

      {/* 免责声明：强制阅读——不可关闭（无 X、点遮罩无反应、Esc 无效），只能滚动到底后点「同意」 */}
      <Dialog
        open={termsOpen}
        onOpenChange={(open) => {
          if (open) setTermsOpen(true); // 任何关闭请求一律忽略
        }}
      >
        <DialogContent
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="gap-0 p-0 sm:max-w-4xl"
        >
          <DialogHeader className="flex-row items-center gap-3 border-b px-6 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div className="space-y-0.5">
              <DialogTitle className="text-base">Catty 使用须知与免责声明</DialogTitle>
              <p className="text-xs text-muted-foreground">
                版本 v1.0 · 生效日期 2026-09-18 · 请在登录前完整阅读以下全部条款
              </p>
            </div>
          </DialogHeader>

          <div
            ref={termsBodyRef}
            onScroll={handleTermsScroll}
            className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-muted-foreground"
          >
            <p className="rounded-lg border bg-muted/40 p-3 text-foreground/80">
              本《使用须知与免责声明》（以下简称"本声明"）是您与 Catty
              项目作者及贡献者之间就使用本软件所达成的约定。请您在使用前审慎阅读、充分理解各条款内容，特别是以粗体或色块标注的免责、责任限制及禁止性条款。
              <span className="font-medium text-foreground">
                {" "}
                一旦您下载、安装、访问或以任何方式使用本软件，即视为您已阅读、理解并同意接受本声明的全部约束。
              </span>
            </p>

            <section className="space-y-2">
              <h4 className="flex items-center gap-2 font-medium text-destructive">
                <span className="flex size-5 items-center justify-center rounded-md bg-destructive/10 text-xs font-semibold text-destructive">
                  1
                </span>
                <AlertTriangle className="size-4" />
                第一条 · 七猫网络安全红线
              </h4>
              <div className="ml-7 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-foreground">
                <p className="font-medium">
                  请遵守《中华人民共和国网络安全法》及七猫文化传媒公司安全规定：
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-destructive/70">
                  <li>严禁对公司和互联网上任何资产，进行任何形式的未授权测试！</li>
                  <li>严禁对测试目标执行破坏性操作，无论测试/生产环境！</li>
                  <li>严禁测试期间无人值守，盲目扩大未知测试范围！</li>
                </ul>
              </div>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  2
                </span>
                第二条 · 定义与开源许可
              </h4>
              <p className="pl-7">
                本软件（Catty）是一款基于 GNU Affero General Public License
                v3.0（AGPL-3.0）发布的开源程序。您可依据该协议自由使用、复制、修改和分发本软件；但任何衍生作品（包括通过网络向第三方提供的在线服务）均须同样以
                AGPL-3.0 协议开源并向使用者公开对应的完整源代码。AGPL-3.0 完整条款以随附的 LICENSE 文件为准。
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  3
                </span>
                第三条 · 授权使用范围
              </h4>
              <p className="pl-7">
                本软件仅供个人学习、代码研究、安全技术原理探讨，以及在您自行搭建的本地隔离环境中进行技术验证之用，适用于学习、学术研究、代码审阅等非攻击性、非破坏性用途。除本条明确许可的情形外，您不得将本软件用于任何其他目的。
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  4
                </span>
                第四条 · 知识产权
              </h4>
              <p className="pl-7">
                本软件的著作权及相关知识产权归项目作者及贡献者所有，并在 AGPL-3.0
                协议约定的范围内向您授予相应权利。除该协议明确授予的权利外，本声明未以明示或默示方式授予您任何其他权利。
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  5
                </span>
                第五条 · 数据与隐私
              </h4>
              <p className="pl-7">
                本软件为可自行部署的开源程序，作者不运营任何集中式服务、亦不会收集或上传您的使用数据。您在使用过程中产生、处理或接触的一切数据，均由您自行掌控并负责其合法性与安全性；因数据处理不当引发的任何后果由您自行承担。
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  6
                </span>
                第六条 · 合规与法律责任
              </h4>
              <p className="pl-7">
                您应自行遵守所在国家或地区关于网络安全、数据安全与个人信息保护、计算机犯罪等方面的全部法律法规（在中国大陆包括但不限于《网络安全法》《数据安全法》《个人信息保护法》及相关司法解释）。
                <span className="font-medium text-foreground">
                  {" "}
                  因您违反上述法律法规或本声明约定而产生的一切法律责任与后果，均由您本人独立承担，与本软件作者及贡献者无关。
                </span>
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  7
                </span>
                第七条 · 免责声明与责任限制
              </h4>
              <p className="pl-7">
                本软件按"现状（AS IS）"与"现有（AS
                AVAILABLE）"状态提供，不附带任何明示或默示的担保，包括但不限于对适销性、特定用途适用性、准确性及不侵权的担保。在适用法律允许的最大范围内，本软件作者及贡献者不对因使用或无法使用本软件（无论使用方式是否得当）而导致的任何直接、间接、偶然、特殊或后果性损失承担责任，包括但不限于数据丢失、系统损坏、业务中断、利润损失或法律纠纷。
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  8
                </span>
                第八条 · 条款变更与最终解释
              </h4>
              <p className="pl-7">
                作者有权根据法律法规或项目发展需要不时更新本声明，更新后的版本将随项目发布并自公布之日起生效；您继续使用本软件即视为接受修订后的条款。在法律允许的范围内，本声明的最终解释权归项目作者所有。若本声明任一条款被认定为无效，不影响其余条款的效力。
              </p>
            </section>
          </div>

          <DialogFooter className="mx-0 mb-0 flex-col items-stretch gap-2 rounded-b-xl px-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {countdown > 0
                ? `请阅读上述条款，${countdown} 秒后方可确认`
                : readToEnd
                  ? "您已浏览全部条款"
                  : "请将条款滚动至底部后再确认"}
            </p>
            <Button
              type="button"
              disabled={!readToEnd || countdown > 0}
              onClick={() => {
                setAgreed(true);
                setError("");
                // 显式关闭：onOpenChange 只接受「打开」，此处是唯一出口
                setTermsOpen(false);
              }}
            >
              {countdown > 0 ? `同意（${countdown}s）` : "我已阅读并同意全部条款"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
