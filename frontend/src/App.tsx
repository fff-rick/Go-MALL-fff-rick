import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams
} from "react-router-dom";
import {
  ENABLE_PAYMENT_SIMULATION,
  FEATURED_PRODUCT_IDS,
  MANAGED_PRODUCT_IDS,
  PAYMENT_SOURCE
} from "./config";
import {
  ApiError,
  callbackPayment,
  createOrder,
  createPayment,
  createProduct,
  fetchOrderDetail,
  fetchOrdersByUser,
  fetchPaymentDetail,
  fetchProductDetail,
  fetchUserInfo,
  login,
  registerUser,
  removeProduct,
  updateProduct
} from "./lib/api";
import {
  clearSession,
  readPaymentReference,
  readSession,
  writePaymentReference,
  writeSession
} from "./lib/storage";
import type { Order, Payment, Product, SessionState } from "./types";

interface AuthContextValue extends SessionState {
  isAuthenticated: boolean;
  signIn: (token: string, expiresAt: number) => Promise<void>;
  refreshUser: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(() => readSession());

  async function refreshUser() {
    if (!session.token) {
      return;
    }
    const user = await fetchUserInfo(session.token);
    const nextSession = { ...session, user };
    setSession(nextSession);
    writeSession(nextSession);
  }

  async function signIn(token: string, expiresAt: number) {
    const user = await fetchUserInfo(token);
    const nextSession = { token, expiresAt, user };
    setSession(nextSession);
    writeSession(nextSession);
  }

  function signOut() {
    clearSession();
    setSession({ token: null, expiresAt: null, user: null });
  }

  useEffect(() => {
    if (!session.token || session.user) {
      return;
    }
    refreshUser().catch(() => {
      signOut();
    });
  }, [session.token, session.user]);

  const value: AuthContextValue = {
    ...session,
    isAuthenticated: Boolean(session.token),
    signIn,
    refreshUser,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

function AppShell() {
  const auth = useAuth();
  const location = useLocation();

  return (
    <div className="app-frame">
      <div className="grain" />
      <header className="masthead">
        <Link className="brand-lockup" to="/">
          <span className="brand-emblem">FM</span>
          <span>
            <strong>Forge Mall</strong>
            <small>industrial retail console</small>
          </span>
        </Link>
        <nav className="main-nav">
          <Link to="/">首页</Link>
          <Link to="/orders">订单</Link>
          <Link to="/profile">账户</Link>
          <Link to="/ops">运营台</Link>
        </nav>
        <div className="header-actions">
          {auth.user ? <span className="user-chip">{auth.user.name}</span> : null}
          {auth.isAuthenticated ? (
            <button className="ghost-button" onClick={() => auth.signOut()} type="button">
              退出
            </button>
          ) : (
            <Link className="primary-button compact" to="/auth">
              登录 / 注册
            </Link>
          )}
        </div>
      </header>
      <main className={`page-shell ${location.pathname.startsWith("/ops") ? "ops-shell" : ""}`}>
        <Outlet />
      </main>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.isAuthenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/auth" />;
  }
  return <>{children}</>;
}

function HomePage() {
  const auth = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token) {
      return;
    }

    setLoading(true);
    setError(null);
    Promise.all(
      FEATURED_PRODUCT_IDS.map(async (id) => {
        try {
          return await fetchProductDetail(id, auth.token as string);
        } catch {
          return null;
        }
      })
    )
      .then((items) => setProducts(items.filter(Boolean) as Product[]))
      .catch((cause: unknown) => setError(toMessage(cause)))
      .finally(() => setLoading(false));
  }, [auth.token]);

  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">FORGED TRANSACTIONS</p>
          <h1>把你现有的微服务交易链路，压缩成一个可操作的前端界面。</h1>
          <p className="lead">
            这个版本基于现有 `user / product / order / pay` API 真实实现，不伪造商品列表、不假装存在购物车。
            所有页面都围绕下单与支付闭环展开。
          </p>
          <div className="hero-actions">
            <Link className="primary-button" to={auth.isAuthenticated ? "/orders" : "/auth"}>
              {auth.isAuthenticated ? "查看我的订单" : "进入账户中心"}
            </Link>
            <Link className="ghost-button" to="/ops">
              打开运营台
            </Link>
          </div>
        </div>
        <div className="hero-aside">
          <MetricCard hint="/api/user/*" label="用户服务" value="8000" />
          <MetricCard hint="/api/product/*" label="商品服务" value="8001" />
          <MetricCard hint="/api/order/*" label="订单服务" value="8002" />
          <MetricCard hint="/api/pay/*" label="支付服务" value="8003" />
        </div>
      </section>

      <section className="section-block">
        <SectionHeading
          eyebrow="SELECTED GOODS"
          summary="当前后端没有商品列表接口，所以首页按预设商品 ID 加载。你可以在运营台里创建或修改这些商品。"
          title="精选商品墙"
        />
        {!auth.isAuthenticated ? (
          <EmptyState
            body="现有 product API 全部挂在 JWT 下。先登录，再读取精选商品和商品详情。"
            ctaHref="/auth"
            ctaLabel="去登录"
            title="商品接口需要登录态"
          />
        ) : loading ? (
          <p className="surface-note">正在装载精选商品…</p>
        ) : error ? (
          <p className="surface-note error-note">{error}</p>
        ) : products.length === 0 ? (
          <p className="surface-note">精选商品为空。请先在运营台创建商品，默认使用 ID 1-4 作为展示位。</p>
        ) : (
          <div className="product-grid">
            {products.map((product, index) => (
              <article className="product-card" key={product.id} style={{ animationDelay: `${index * 90}ms` }}>
                <span className="product-status">{product.status === 1 ? "已上架" : "待处理"}</span>
                <h3>{product.name}</h3>
                <p>{product.desc || "暂无描述，建议在运营台补全商品说明。"}</p>
                <div className="product-meta">
                  <strong>{formatCurrency(product.amount)}</strong>
                  <span>库存 {product.stock}</span>
                </div>
                <div className="product-actions">
                  <Link className="ghost-button compact" to={`/product/${product.id}`}>
                    查看详情
                  </Link>
                  <Link className="primary-button compact" to={`/checkout/${product.id}`}>
                    立即下单
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section-block dual-grid">
        <div className="surface-panel">
          <SectionHeading
            eyebrow="MVP FLOW"
            summary="登录、查看商品、创建订单、生成支付单、模拟支付回调、回查订单。"
            title="当前支持的用户动作"
          />
          <ol className="flow-list">
            <li>登录或注册后，前端向 `user.api` 获取 JWT 与用户信息。</li>
            <li>商品详情与首页精选位通过 `product.detail` 拉取。</li>
            <li>下单调用 `order.create`，随后用 `order.list` 回查最新订单 ID。</li>
            <li>支付页调用 `pay.create` 生成支付单，再用 `pay.detail` 刷新状态。</li>
            <li>开发环境可直接触发 `pay.callback`，驱动订单状态变为已支付。</li>
          </ol>
        </div>
        <div className="surface-panel warning-panel">
          <SectionHeading
            eyebrow="KNOWN LIMITS"
            summary="这个前端不会用假数据把问题藏起来，而是把当前 API 的边界显示给你。"
            title="后端缺口已在界面里显式处理"
          />
          <ul className="dense-list">
            <li>没有商品列表接口，所以首页使用固定商品位。</li>
            <li>商品详情也需要 JWT，所以未登录用户只能先看到壳层与说明。</li>
            <li>订单创建响应未返回订单 ID，所以前端用用户订单列表回查最新订单。</li>
            <li>没有第三方支付集成，所以支付页提供开发环境回调按钮。</li>
          </ul>
        </div>
      </section>
    </>
  );
}

function AuthPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);

    try {
      if (mode === "login") {
        const mobile = String(form.get("mobile") ?? "");
        const password = String(form.get("password") ?? "");
        const response = await login(mobile, password);
        await auth.signIn(response.accessToken, response.accessExpire);
        navigate(location.state?.from ?? "/", { replace: true });
      } else {
        await registerUser({
          name: String(form.get("name") ?? ""),
          gender: Number(form.get("gender") ?? 1),
          mobile: String(form.get("mobile") ?? ""),
          password: String(form.get("password") ?? "")
        });
        setSuccess("注册成功，请直接登录。");
        setMode("login");
      }
    } catch (cause) {
      setError(toMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-shell">
      <div className="surface-panel auth-intro">
        <p className="eyebrow">ENTRY GATE</p>
        <h1>先拿到 JWT，再接管商品、订单与支付能力。</h1>
        <p className="lead">
          当前 API 设计里，商品与订单都依赖登录态。这个页面因此不是附属功能，而是整个商城前端的总开关。
        </p>
        <div className="auth-switch">
          <button
            className={mode === "login" ? "tab-button active" : "tab-button"}
            onClick={() => setMode("login")}
            type="button"
          >
            登录
          </button>
          <button
            className={mode === "register" ? "tab-button active" : "tab-button"}
            onClick={() => setMode("register")}
            type="button"
          >
            注册
          </button>
        </div>
      </div>

      <form className="surface-panel form-panel" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <label>
            用户名
            <input name="name" placeholder="例如：铁匠铺采购员" required />
          </label>
        ) : null}
        {mode === "register" ? (
          <label>
            性别
            <select defaultValue="1" name="gender">
              <option value="1">男</option>
              <option value="2">女</option>
              <option value="0">未说明</option>
            </select>
          </label>
        ) : null}
        <label>
          手机号
          <input inputMode="numeric" name="mobile" placeholder="11 位手机号" required />
        </label>
        <label>
          密码
          <input name="password" placeholder="请输入密码" required type="password" />
        </label>
        {error ? <p className="form-feedback error-note">{error}</p> : null}
        {success ? <p className="form-feedback success-note">{success}</p> : null}
        <button className="primary-button wide" disabled={busy} type="submit">
          {busy ? "处理中…" : mode === "login" ? "登录并进入商城" : "提交注册"}
        </button>
      </form>
    </section>
  );
}

function ProductPage() {
  const auth = useAuth();
  const params = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token || !params.productId) {
      return;
    }
    fetchProductDetail(Number(params.productId), auth.token)
      .then(setProduct)
      .catch((cause) => setError(toMessage(cause)));
  }, [auth.token, params.productId]);

  if (!product && error) {
    return <SurfaceMessage body={error} title="商品读取失败" tone="error" />;
  }

  if (!product) {
    return <SurfaceMessage body="稍等，前端正在向 product 服务拉取数据。" title="正在读取商品详情" />;
  }

  return (
    <section className="product-stage">
      <div className="product-visual">
        <span className="floating-tag">PID {product.id}</span>
        <div className="visual-plate">
          <strong>{product.name.slice(0, 1)}</strong>
        </div>
      </div>
      <div className="surface-panel product-detail-panel">
        <p className="eyebrow">PRODUCT DOSSIER</p>
        <h1>{product.name}</h1>
        <p className="lead">{product.desc || "暂无描述，建议在运营台补足卖点、材质与使用场景。"}</p>
        <div className="detail-matrix">
          <InfoPair label="价格" value={formatCurrency(product.amount)} />
          <InfoPair label="库存" value={`${product.stock}`} />
          <InfoPair label="状态" value={product.status === 1 ? "已上架" : "待调整"} />
          <InfoPair label="购买方式" value="单品直购" />
        </div>
        <div className="product-actions">
          <Link className="primary-button" to={`/checkout/${product.id}`}>
            进入下单台
          </Link>
          <Link className="ghost-button" to="/">
            返回首页
          </Link>
        </div>
      </div>
    </section>
  );
}

function CheckoutPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token || !params.productId) {
      return;
    }
    fetchProductDetail(Number(params.productId), auth.token)
      .then(setProduct)
      .catch((cause) => setError(toMessage(cause)));
  }, [auth.token, params.productId]);

  async function submitOrder() {
    if (!auth.token || !auth.user || !product) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await createOrder(auth.token, {
        uid: auth.user.id,
        pid: product.id,
        amount: quantity,
        status: 0
      });

      const resolvedOrderId =
        response.id ?? (await resolveLatestOrderId(auth.token, auth.user.id, product.id, quantity));
      const total = product.amount * quantity;
      navigate(`/pay/${resolvedOrderId}?total=${total}&pid=${product.id}`);
    } catch (cause) {
      setError(toMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!product && error) {
    return <SurfaceMessage body={error} title="下单页初始化失败" tone="error" />;
  }

  if (!product) {
    return <SurfaceMessage body="系统正在校验商品信息与库存。" title="正在准备下单台" />;
  }

  const total = product.amount * quantity;

  return (
    <section className="checkout-grid">
      <div className="surface-panel form-panel">
        <p className="eyebrow">ORDER STATION</p>
        <h1>确认你的采购参数</h1>
        <div className="detail-matrix">
          <InfoPair label="商品" value={product.name} />
          <InfoPair label="单价" value={formatCurrency(product.amount)} />
          <InfoPair label="库存" value={`${product.stock}`} />
          <InfoPair label="账户" value={auth.user?.mobile ?? "-"} />
        </div>
        <label>
          购买数量
          <input
            max={product.stock || undefined}
            min={1}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
            type="number"
            value={quantity}
          />
        </label>
        {error ? <p className="form-feedback error-note">{error}</p> : null}
        <button
          className="primary-button wide"
          disabled={busy || quantity > product.stock}
          onClick={submitOrder}
          type="button"
        >
          {busy ? "正在创建订单…" : "创建订单并前往支付"}
        </button>
      </div>
      <aside className="surface-panel summary-panel">
        <p className="eyebrow">ORDER SUMMARY</p>
        <ul className="summary-list">
          <li>
            <span>商品金额</span>
            <strong>{formatCurrency(total)}</strong>
          </li>
          <li>
            <span>订单数量字段</span>
            <strong>{quantity}</strong>
          </li>
          <li>
            <span>库存影响</span>
            <strong>将扣减 {quantity}</strong>
          </li>
        </ul>
        <p className="surface-note">
          你的后端把 `order.amount` 当成购买数量处理，并直接传给库存扣减分支；这里已按那个真实逻辑适配。
        </p>
      </aside>
    </section>
  );
}

function PayPage() {
  const auth = useAuth();
  const params = useParams();
  const location = useLocation();
  const orderId = Number(params.orderId);
  const query = new URLSearchParams(location.search);
  const hintedTotal = Number(query.get("total") ?? 0);
  const [order, setOrder] = useState<Order | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentInitialized, setPaymentInitialized] = useState(false);
  const [manualPaymentId, setManualPaymentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setPayment(null);
    setPaymentInitialized(false);
    setManualPaymentId("");
    setError(null);
    setNotice(null);
  }, [orderId]);

  useEffect(() => {
    if (!auth.token || !orderId) {
      return;
    }

    fetchOrderDetail(auth.token, orderId)
      .then(async (loadedOrder) => {
        setOrder(loadedOrder);
        const loadedProduct = await fetchProductDetail(loadedOrder.pid, auth.token as string);
        setProduct(loadedProduct);
      })
      .catch((cause) => setError(toMessage(cause)));
  }, [auth.token, orderId]);

  useEffect(() => {
    if (!auth.token || !auth.user || !order || paymentInitialized) {
      return;
    }

    const existingPaymentId = readPaymentReference(order.id);
    if (existingPaymentId) {
      setPaymentInitialized(true);
      fetchPaymentDetail(auth.token, existingPaymentId)
        .then(setPayment)
        .catch((cause) => setError(toMessage(cause)));
      return;
    }

    const total = product ? product.amount * order.amount : hintedTotal;
    if (!total) {
      return;
    }

    setPaymentInitialized(true);
    setBusy(true);
    createPayment(auth.token, {
      uid: auth.user.id,
      oid: order.id,
      source: PAYMENT_SOURCE,
      amount: total
    })
      .then(async (response) => {
        writePaymentReference(order.id, response.id);
        const loadedPayment = await fetchPaymentDetail(auth.token as string, response.id);
        setPayment(loadedPayment);
        setNotice("支付单已创建。");
      })
      .catch((cause) => {
        setError(
          `${toMessage(cause)}。如果后端里已经存在支付单但本地没有记录，请在下方手动输入 payId 回查。`
        );
      })
      .finally(() => setBusy(false));
  }, [auth.token, auth.user, hintedTotal, order, paymentInitialized, product]);

  async function refreshPayment(targetId?: number) {
    if (!auth.token) {
      return;
    }
    const currentId = targetId ?? payment?.id ?? Number(manualPaymentId);
    if (!currentId) {
      setError("请输入支付单 ID。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const loadedPayment = await fetchPaymentDetail(auth.token, currentId);
      if (order) {
        writePaymentReference(order.id, loadedPayment.id);
      }
      setPayment(loadedPayment);
    } catch (cause) {
      setError(toMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function simulatePaymentSuccess() {
    if (!auth.token || !auth.user || !order || !payment) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await callbackPayment(auth.token, {
        id: payment.id,
        uid: auth.user.id,
        oid: order.id,
        amount: payment.amount,
        source: payment.source,
        status: 1
      });
      const refreshed = await fetchPaymentDetail(auth.token, payment.id);
      setPayment(refreshed);
      setNotice("模拟回调完成，订单应已标记为支付成功。");
    } catch (cause) {
      setError(toMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!order) {
    return (
      <SurfaceMessage
        body={error ?? "稍等，系统正在读取订单与商品信息。"}
        title="正在生成支付界面"
        tone={error ? "error" : "default"}
      />
    );
  }

  const total = payment?.amount ?? (product ? product.amount * order.amount : hintedTotal);

  return (
    <section className="checkout-grid">
      <div className="surface-panel summary-panel">
        <p className="eyebrow">PAYMENT RAIL</p>
        <h1>支付单控制台</h1>
        <ul className="summary-list">
          <li>
            <span>订单号</span>
            <strong>#{order.id}</strong>
          </li>
          <li>
            <span>商品</span>
            <strong>{product?.name ?? `PID ${order.pid}`}</strong>
          </li>
          <li>
            <span>支付金额</span>
            <strong>{formatCurrency(total)}</strong>
          </li>
          <li>
            <span>支付状态</span>
            <strong>{renderPaymentStatus(payment?.status)}</strong>
          </li>
        </ul>
        {notice ? <p className="form-feedback success-note">{notice}</p> : null}
        {error ? <p className="form-feedback error-note">{error}</p> : null}
      </div>

      <div className="surface-panel form-panel">
        <label>
          手动回查支付单 ID
          <div className="inline-form">
            <input
              onChange={(event) => setManualPaymentId(event.target.value)}
              placeholder="例如 12"
              value={manualPaymentId}
            />
            <button className="ghost-button compact" onClick={() => refreshPayment()} type="button">
              回查
            </button>
          </div>
        </label>
        <div className="button-stack">
          <button className="primary-button wide" disabled={busy} onClick={() => refreshPayment(payment?.id)} type="button">
            {busy ? "处理中…" : "刷新支付状态"}
          </button>
          {ENABLE_PAYMENT_SIMULATION ? (
            <button className="ghost-button wide" disabled={busy || !payment} onClick={simulatePaymentSuccess} type="button">
              开发环境模拟支付成功
            </button>
          ) : null}
          <Link className="ghost-button wide" to="/orders">
            返回订单列表
          </Link>
        </div>
        <p className="surface-note">
          当前仓库没有接第三方支付网关，所以这里保留了模拟回调入口。真正接网关后，只需要移除这个按钮，改成等待服务端异步通知。
        </p>
      </div>
    </section>
  );
}

function OrdersPage() {
  const auth = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Record<number, Product>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token || !auth.user) {
      return;
    }

    setLoading(true);
    fetchOrdersByUser(auth.token, auth.user.id)
      .then(async (loadedOrders) => {
        const sorted = [...loadedOrders].sort((left, right) => right.id - left.id);
        setOrders(sorted);
        const uniqueProductIds = [...new Set(sorted.map((order) => order.pid))];
        const productEntries = await Promise.all(
          uniqueProductIds.map(async (id) => {
            try {
              const detail = await fetchProductDetail(id, auth.token as string);
              return [id, detail] as const;
            } catch {
              return null;
            }
          })
        );
        setProducts(Object.fromEntries(productEntries.filter(Boolean) as Array<readonly [number, Product]>));
      })
      .catch((cause) => setError(toMessage(cause)))
      .finally(() => setLoading(false));
  }, [auth.token, auth.user]);

  if (loading) {
    return <SurfaceMessage body="系统正在整合 order 和 product 数据。" title="正在拉取订单" />;
  }

  if (error) {
    return <SurfaceMessage body={error} title="订单读取失败" tone="error" />;
  }

  return (
    <section className="section-block">
      <SectionHeading
        eyebrow="ORDER LEDGER"
        summary="订单数据来自 `order.list`，商品信息额外通过 `product.detail` 做补足。"
        title="我的订单"
      />
      {orders.length === 0 ? (
        <EmptyState body="先从首页精选商品进入下单流程。" ctaHref="/" ctaLabel="回首页" title="你还没有订单" />
      ) : (
        <div className="order-grid">
          {orders.map((order) => (
            <article className="order-card" key={order.id}>
              <div className="card-topline">
                <strong>#{order.id}</strong>
                <span className={`status-pill status-${order.status}`}>{renderOrderStatus(order.status)}</span>
              </div>
              <h3>{products[order.pid]?.name ?? `商品 ${order.pid}`}</h3>
              <ul className="summary-list compact-list">
                <li>
                  <span>商品 ID</span>
                  <strong>{order.pid}</strong>
                </li>
                <li>
                  <span>数量</span>
                  <strong>{order.amount}</strong>
                </li>
                <li>
                  <span>估算总价</span>
                  <strong>{formatCurrency((products[order.pid]?.amount ?? 0) * order.amount)}</strong>
                </li>
              </ul>
              <div className="product-actions">
                <Link className="ghost-button compact" to={`/pay/${order.id}`}>
                  支付 / 查询
                </Link>
                <Link className="primary-button compact" to={`/product/${order.pid}`}>
                  查看商品
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ProfilePage() {
  const auth = useAuth();

  if (!auth.user) {
    return <SurfaceMessage body="请重新登录后刷新当前页面。" title="账户资料未就绪" />;
  }

  return (
    <section className="section-block dual-grid">
      <div className="surface-panel">
        <SectionHeading
          eyebrow="USER DOSSIER"
          summary="这些数据来自 `user.userinfo`，前端会在登录后自动拉取并缓存到本地。"
          title="账户资料"
        />
        <div className="detail-matrix">
          <InfoPair label="用户 ID" value={`${auth.user.id}`} />
          <InfoPair label="姓名" value={auth.user.name} />
          <InfoPair label="手机号" value={auth.user.mobile} />
          <InfoPair label="性别" value={renderGender(auth.user.gender)} />
        </div>
      </div>
      <div className="surface-panel warning-panel">
        <SectionHeading
          eyebrow="SESSION"
          summary="当前前端把 token 和 payId 映射保存在浏览器本地存储，用来支撑订单与支付回查。"
          title="会话状态"
        />
        <ul className="dense-list">
          <li>JWT 已登录: {auth.isAuthenticated ? "是" : "否"}</li>
          <li>过期时间戳: {auth.expiresAt ?? "-"}</li>
          <li>
            支付映射策略: <code>orderId -&gt; payId</code>
          </li>
          <li>接口代理: Vite 将 `/api/*` 分发到 `8000-8003`</li>
        </ul>
      </div>
    </section>
  );
}

function OpsPage() {
  const auth = useAuth();
  const [managedProducts, setManagedProducts] = useState<Product[]>([]);
  const [lookupId, setLookupId] = useState("1");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [opsOrders, setOpsOrders] = useState<Order[]>([]);
  const [orderLookupUid, setOrderLookupUid] = useState("");
  const [paymentLookupId, setPaymentLookupId] = useState("");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token) {
      return;
    }
    Promise.all(
      MANAGED_PRODUCT_IDS.map(async (id) => {
        try {
          return await fetchProductDetail(id, auth.token as string);
        } catch {
          return null;
        }
      })
    ).then((items) => setManagedProducts(items.filter(Boolean) as Product[]));
  }, [auth.token]);

  async function handleCreateProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.token) {
      return;
    }
    const form = new FormData(event.currentTarget);
    setError(null);
    setNotice(null);
    try {
      const created = await createProduct(auth.token, {
        name: String(form.get("name") ?? ""),
        desc: String(form.get("desc") ?? ""),
        stock: Number(form.get("stock") ?? 0),
        amount: Number(form.get("amount") ?? 0),
        status: Number(form.get("status") ?? 1)
      });
      setNotice(`商品已创建，ID ${created.id}。`);
      setManagedProducts((current) => [created, ...current].slice(0, 8));
      event.currentTarget.reset();
    } catch (cause) {
      setError(toMessage(cause));
    }
  }

  async function handleLookupProduct() {
    if (!auth.token) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const loaded = await fetchProductDetail(Number(lookupId), auth.token);
      setEditingProduct(loaded);
    } catch (cause) {
      setError(toMessage(cause));
    }
  }

  async function handleUpdateProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.token || !editingProduct) {
      return;
    }
    const form = new FormData(event.currentTarget);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateProduct(auth.token, {
        id: editingProduct.id,
        name: String(form.get("name") ?? editingProduct.name),
        desc: String(form.get("desc") ?? editingProduct.desc),
        stock: Number(form.get("stock") ?? editingProduct.stock),
        amount: Number(form.get("amount") ?? editingProduct.amount),
        status: Number(form.get("status") ?? editingProduct.status)
      });
      setEditingProduct(updated);
      setNotice(`商品 ${updated.id} 已更新。`);
    } catch (cause) {
      setError(toMessage(cause));
    }
  }

  async function handleRemoveProduct() {
    if (!auth.token || !editingProduct) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await removeProduct(auth.token, editingProduct.id);
      setNotice(`商品 ${editingProduct.id} 已删除。`);
      setEditingProduct(null);
    } catch (cause) {
      setError(toMessage(cause));
    }
  }

  async function handleOrderLookup() {
    if (!auth.token) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const loaded = await fetchOrdersByUser(auth.token, Number(orderLookupUid));
      setOpsOrders(loaded.sort((left, right) => right.id - left.id));
    } catch (cause) {
      setError(toMessage(cause));
    }
  }

  async function handlePaymentLookup() {
    if (!auth.token) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const loaded = await fetchPaymentDetail(auth.token, Number(paymentLookupId));
      setPayment(loaded);
    } catch (cause) {
      setError(toMessage(cause));
    }
  }

  return (
    <section className="ops-grid">
      <div className="surface-panel span-two">
        <SectionHeading
          eyebrow="OPS LANE"
          summary="这里不伪造一个完整 ERP。页面只提供你当前后端能真实支撑的动作：商品增改删、按 ID 查商品、按用户查订单、按 payId 查支付单。"
          title="运营台"
        />
        {error ? <p className="form-feedback error-note">{error}</p> : null}
        {notice ? <p className="form-feedback success-note">{notice}</p> : null}
      </div>

      <div className="surface-panel">
        <h2>精选商品看板</h2>
        <div className="mini-grid">
          {managedProducts.map((item) => (
            <article className="mini-product-card" key={item.id}>
              <strong>#{item.id}</strong>
              <span>{item.name}</span>
              <small>{formatCurrency(item.amount)} / 库存 {item.stock}</small>
            </article>
          ))}
        </div>
      </div>

      <form className="surface-panel form-panel" onSubmit={handleCreateProduct}>
        <h2>创建商品</h2>
        <label>
          名称
          <input name="name" placeholder="例如：锻压旅行杯" required />
        </label>
        <label>
          描述
          <textarea name="desc" placeholder="写清材质、场景和卖点" rows={4} />
        </label>
        <label>
          库存
          <input defaultValue="10" min={0} name="stock" type="number" />
        </label>
        <label>
          金额
          <input defaultValue="199" min={0} name="amount" type="number" />
        </label>
        <label>
          状态
          <select defaultValue="1" name="status">
            <option value="1">上架</option>
            <option value="0">草稿</option>
          </select>
        </label>
        <button className="primary-button wide" type="submit">
          创建商品
        </button>
      </form>

      <div className="surface-panel">
        <h2>按 ID 维护商品</h2>
        <div className="inline-form">
          <input onChange={(event) => setLookupId(event.target.value)} value={lookupId} />
          <button className="ghost-button compact" onClick={handleLookupProduct} type="button">
            读取
          </button>
        </div>
        {editingProduct ? (
          <form className="form-panel nested-panel" onSubmit={handleUpdateProduct}>
            <label>
              名称
              <input defaultValue={editingProduct.name} name="name" />
            </label>
            <label>
              描述
              <textarea defaultValue={editingProduct.desc} name="desc" rows={4} />
            </label>
            <label>
              库存
              <input defaultValue={editingProduct.stock} name="stock" type="number" />
            </label>
            <label>
              金额
              <input defaultValue={editingProduct.amount} name="amount" type="number" />
            </label>
            <label>
              状态
              <select defaultValue={String(editingProduct.status)} name="status">
                <option value="1">上架</option>
                <option value="0">草稿</option>
              </select>
            </label>
            <div className="button-stack">
              <button className="primary-button wide" type="submit">
                更新商品
              </button>
              <button className="ghost-button wide" onClick={handleRemoveProduct} type="button">
                删除商品
              </button>
            </div>
          </form>
        ) : (
          <p className="surface-note">先输入商品 ID 并读取详情。</p>
        )}
      </div>

      <div className="surface-panel">
        <h2>订单查询</h2>
        <div className="inline-form">
          <input
            onChange={(event) => setOrderLookupUid(event.target.value)}
            placeholder="输入 uid"
            value={orderLookupUid}
          />
          <button className="ghost-button compact" onClick={handleOrderLookup} type="button">
            查询
          </button>
        </div>
        <div className="ledger-list">
          {opsOrders.map((item) => (
            <article className="ledger-item" key={item.id}>
              <strong>订单 #{item.id}</strong>
              <small>
                uid {item.uid} / pid {item.pid} / 数量 {item.amount} / {renderOrderStatus(item.status)}
              </small>
            </article>
          ))}
        </div>
      </div>

      <div className="surface-panel">
        <h2>支付单查询</h2>
        <div className="inline-form">
          <input
            onChange={(event) => setPaymentLookupId(event.target.value)}
            placeholder="输入 payId"
            value={paymentLookupId}
          />
          <button className="ghost-button compact" onClick={handlePaymentLookup} type="button">
            查询
          </button>
        </div>
        {payment ? (
          <div className="detail-matrix">
            <InfoPair label="支付单 ID" value={`${payment.id}`} />
            <InfoPair label="订单 ID" value={`${payment.oid}`} />
            <InfoPair label="用户 ID" value={`${payment.uid}`} />
            <InfoPair label="金额" value={formatCurrency(payment.amount)} />
            <InfoPair label="来源" value={`${payment.source}`} />
            <InfoPair label="状态" value={renderPaymentStatus(payment.status)} />
          </div>
        ) : (
          <p className="surface-note">当前后端没有按订单号查支付单的接口，所以这里按 payId 查询。</p>
        )}
      </div>
    </section>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route element={<HomePage />} index />
        <Route element={<AuthPage />} path="/auth" />
        <Route
          element={
            <RequireAuth>
              <ProductPage />
            </RequireAuth>
          }
          path="/product/:productId"
        />
        <Route
          element={
            <RequireAuth>
              <CheckoutPage />
            </RequireAuth>
          }
          path="/checkout/:productId"
        />
        <Route
          element={
            <RequireAuth>
              <PayPage />
            </RequireAuth>
          }
          path="/pay/:orderId"
        />
        <Route
          element={
            <RequireAuth>
              <OrdersPage />
            </RequireAuth>
          }
          path="/orders"
        />
        <Route
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
          path="/profile"
        />
        <Route
          element={
            <RequireAuth>
              <OpsPage />
            </RequireAuth>
          }
          path="/ops"
        />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  summary
}: {
  eyebrow: string;
  title: string;
  summary: string;
}) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{summary}</p>
    </div>
  );
}

function EmptyState({
  title,
  body,
  ctaHref,
  ctaLabel
}: {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="surface-panel empty-state">
      <h3>{title}</h3>
      <p>{body}</p>
      <Link className="primary-button compact" to={ctaHref}>
        {ctaLabel}
      </Link>
    </div>
  );
}

function SurfaceMessage({
  title,
  body,
  tone = "default"
}: {
  title: string;
  body: string;
  tone?: "default" | "error";
}) {
  return (
    <section className={`surface-panel centered-panel ${tone === "error" ? "warning-panel" : ""}`}>
      <h1>{title}</h1>
      <p>{body}</p>
    </section>
  );
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-pair">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0
  }).format(value);
}

function renderOrderStatus(status: number) {
  if (status === 1) {
    return "已支付";
  }
  if (status === 9) {
    return "已回滚";
  }
  return "待支付";
}

function renderPaymentStatus(status?: number) {
  if (status === 1) {
    return "支付成功";
  }
  return "待支付";
}

function renderGender(gender: number) {
  if (gender === 1) {
    return "男";
  }
  if (gender === 2) {
    return "女";
  }
  return "未说明";
}

function toMessage(cause: unknown) {
  if (cause instanceof ApiError) {
    return cause.message;
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  return "发生未知错误";
}

async function resolveLatestOrderId(token: string, uid: number, pid: number, quantity: number) {
  const orders = await fetchOrdersByUser(token, uid);
  const matched = orders
    .filter((order) => order.pid === pid && order.amount === quantity)
    .sort((left, right) => right.id - left.id)[0];

  if (!matched) {
    throw new Error("订单已创建，但前端无法从订单列表回查到最新订单 ID。");
  }

  return matched.id;
}
