'use client';

import { useState, useEffect } from 'react';

export default function LiquidGlassDesignSystem() {
    const [activeTab, setActiveTab] = useState('home');
    const [sliderValue, setSliderValue] = useState(65);
    const [activeSection, setActiveSection] = useState('philosophy');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [toastVisible, setToastVisible] = useState(false);
    const [checkboxChecked, setCheckboxChecked] = useState(false);
    const [radioValue, setRadioValue] = useState('option1');
    const [inputValue, setInputValue] = useState('');
    const [switchOn, setSwitchOn] = useState(true);
    const [showBackToTop, setShowBackToTop] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // 监听滚动显示回到顶部按钮
    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 400);
            // 更新当前章节
            const sectionElements = sections.map(s => document.getElementById(s.id));
            const current = sectionElements.findIndex((el, i) => {
                if (!el) return false;
                const next = sectionElements[i + 1];
                const top = el.getBoundingClientRect().top;
                const nextTop = next?.getBoundingClientRect().top ?? Infinity;
                return top <= 100 && nextTop > 100;
            });
            if (current !== -1) setActiveSection(sections[current].id);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // 复制代码功能
    const copyCode = (code: string, id: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(id);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const sections = [
        { id: 'philosophy', label: '设计理念' },
        { id: 'principles', label: '核心原则' },
        { id: 'colors', label: '色彩系统' },
        { id: 'typography', label: '排版系统' },
        { id: 'spacing', label: '间距系统' },
        { id: 'layout', label: '布局系统' },
        { id: 'elevation', label: '层级系统' },
        { id: 'motion', label: '动效系统' },
        { id: 'materials', label: '材质规范' },
        { id: 'states', label: '状态系统' },
        { id: 'components', label: '组件库' },
        { id: 'forms', label: '表单组件' },
        { id: 'feedback', label: '反馈组件' },
        { id: 'navigation', label: '导航组件' },
        { id: 'usage', label: '使用指南' },
    ];

    return (
        <>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap" rel="stylesheet" />

            <style>{`
                :root {
                    --bg-primary: #F5F5F7;
                    --bg-secondary: #FFFFFF;
                    --text-primary: #1D1D1F;
                    --text-secondary: rgba(0, 0, 0, 0.65);
                    --text-tertiary: rgba(0, 0, 0, 0.45);
                    --glass-bg: rgba(255, 255, 255, 0.25);
                    --glass-border: rgba(255, 255, 255, 0.3);
                    --glass-shadow-inset: rgba(255, 255, 255, 0.5);
                    --code-bg: rgba(0, 0, 0, 0.05);
                }
                
                * { 
                    font-family: 'Noto Sans SC', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    box-sizing: border-box;
                }
                
                html { scroll-behavior: smooth; }
                
                /* 回到顶部按钮 - 克制的样式 */
                .back-to-top {
                    position: fixed;
                    bottom: 32px;
                    right: 32px;
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(20px);
                    color: var(--text-primary);
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
                    transition: all 0.2s ease;
                    z-index: 100;
                    opacity: 0;
                    transform: translateY(20px);
                    pointer-events: none;
                }
                .back-to-top.visible {
                    opacity: 1;
                    transform: translateY(0);
                    pointer-events: auto;
                }
                .back-to-top:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
                }
                
                /* 代码块增强 */
                .code-block-wrapper {
                    position: relative;
                    margin: 16px 0;
                }
                .code-block-wrapper .copy-btn {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    padding: 6px 12px;
                    border-radius: 6px;
                    background: rgba(0, 0, 0, 0.1);
                    border: none;
                    color: rgba(0, 0, 0, 0.5);
                    font-size: 12px;
                    cursor: pointer;
                    opacity: 0;
                    transition: all 0.2s;
                }
                .code-block-wrapper:hover .copy-btn {
                    opacity: 1;
                }
                .copy-btn:hover {
                    background: rgba(0, 122, 255, 0.15);
                    color: #007AFF;
                }
                .copy-btn.copied {
                    background: rgba(52, 199, 89, 0.15);
                    color: #34C759;
                }
                
                
                /* 章节入场动画 */
                section {
                    animation: fadeInUp 0.6s ease-out;
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                /* 卡片悬停动画增强 */
                .glass-card {
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .glass-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 
                        inset 0 1px 0 0 rgba(255, 255, 255, 1),
                        inset 0 -1px 0 0 rgba(255, 255, 255, 0.4),
                        0 2px 4px rgba(0, 0, 0, 0.02),
                        0 8px 24px rgba(0, 0, 0, 0.06),
                        0 24px 64px rgba(0, 0, 0, 0.08);
                }
                
                /* 渐变文字 - 柔和的双色渐变 */
                .gradient-text {
                    background: linear-gradient(135deg, #1D1D1F 0%, #636366 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .gradient-blue { 
                    background: linear-gradient(135deg, #007AFF 0%, #5AC8FA 100%); 
                    -webkit-background-clip: text; 
                    -webkit-text-fill-color: transparent; 
                }
                .gradient-purple { 
                    background: linear-gradient(135deg, #AF52DE 0%, #C77DFF 100%); 
                    -webkit-background-clip: text; 
                    -webkit-text-fill-color: transparent; 
                }
                .gradient-green { 
                    background: linear-gradient(135deg, #34C759 0%, #70E090 100%); 
                    -webkit-background-clip: text; 
                    -webkit-text-fill-color: transparent; 
                }

                /* Liquid Glass 容器 - 高级材质 */
                .glass-card {
                    position: relative;
                    overflow: hidden;
                    border-radius: 28px;
                    /* 多层渐变模拟玻璃内部光线 */
                    background: 
                        linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.3) 100%),
                        rgba(255, 255, 255, 0.15);
                    backdrop-filter: blur(60px) saturate(180%);
                    -webkit-backdrop-filter: blur(60px) saturate(180%);
                    /* 精致边框 */
                    border: 1px solid rgba(255, 255, 255, 0.6);
                    /* 多层精致阴影 */
                    box-shadow: 
                        inset 0 1px 0 0 rgba(255, 255, 255, 0.9),
                        inset 0 -1px 0 0 rgba(255, 255, 255, 0.3),
                        0 1px 3px rgba(0, 0, 0, 0.02),
                        0 4px 12px rgba(0, 0, 0, 0.04),
                        0 16px 48px rgba(0, 0, 0, 0.06);
                }
                /* 玻璃顶部高光条 */
                .glass-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 32px;
                    right: 32px;
                    height: 1px;
                    background: linear-gradient(90deg, 
                        transparent 0%, 
                        rgba(255,255,255,0.6) 15%, 
                        rgba(255,255,255,1) 50%, 
                        rgba(255,255,255,0.6) 85%, 
                        transparent 100%);
                }

                /* 章节标题 */
                .section-title {
                    font-size: 13px;
                    font-weight: 600;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: rgba(0, 0, 0, 0.45);
                    margin-bottom: 12px;
                }
                
                .section-headline {
                    font-size: 32px;
                    font-weight: 700;
                    color: #1D1D1F;
                    margin-bottom: 16px;
                    letter-spacing: -0.02em;
                }
                
                .section-body {
                    font-size: 17px;
                    line-height: 1.6;
                    color: rgba(0, 0, 0, 0.65);
                }
                
                /* 导航栏 */
                .nav-link {
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    color: rgba(0, 0, 0, 0.6);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: none;
                    background: transparent;
                }
                .nav-link:hover {
                    background: rgba(0, 0, 0, 0.04);
                    color: #1D1D1F;
                }
                .nav-link.active {
                    background: rgba(255, 255, 255, 0.6);
                    color: #007AFF;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
                }

                /* 动画 */
                @keyframes pulse-glow {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.5; }
                }
                .blur-orb { animation: pulse-glow 10s ease-in-out infinite; }
                
                /* 按钮 */
                .btn {
                    padding: 12px 24px;
                    border-radius: 12px;
                    border: none;
                    font-weight: 600;
                    font-size: 15px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .btn:hover { filter: brightness(1.05); transform: translateY(-1px); }
                .btn:active { transform: scale(0.98); }
                .btn-primary { background: #007AFF; color: #fff; }
                .btn-secondary { background: rgba(0,0,0,0.06); color: #1D1D1F; }
                .btn-glass { 
                    background: rgba(255,255,255,0.5); 
                    color: #1D1D1F; 
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.3);
                }
                
                /* 代码块 */
                .code-block {
                    background: rgba(0, 0, 0, 0.04);
                    border-radius: 12px;
                    padding: 16px 20px;
                    font-family: 'SF Mono', 'Menlo', monospace;
                    font-size: 14px;
                    color: #1D1D1F;
                    overflow-x: auto;
                }
                .code-block code { color: #AF52DE; }
                
                /* 颜色色块 */
                .color-swatch {
                    width: 100%;
                    aspect-ratio: 1;
                    border-radius: 16px;
                    position: relative;
                    overflow: hidden;
                }
                .color-swatch::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: inherit;
                    box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);
                }
                
                /* 滑块 */
                .slider-track {
                    width: 100%;
                    height: 6px;
                    border-radius: 3px;
                    background: rgba(0, 0, 0, 0.1);
                    position: relative;
                }
                .slider-fill {
                    height: 100%;
                    border-radius: 3px;
                    background: linear-gradient(90deg, #007AFF, #5AC8FA);
                }
                .slider-thumb {
                    position: absolute;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.6);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    cursor: pointer;
                }
                
                /* 输入框 */
                .input-field {
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 12px;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                    background: rgba(255, 255, 255, 0.6);
                    backdrop-filter: blur(10px);
                    font-size: 15px;
                    color: #1D1D1F;
                    transition: all 0.2s ease;
                    outline: none;
                }
                .input-field:focus {
                    border-color: #007AFF;
                    box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.15);
                }
                .input-field::placeholder { color: rgba(0, 0, 0, 0.35); }
                .input-field:disabled { opacity: 0.5; cursor: not-allowed; }
                
                /* 开关 */
                .switch {
                    width: 51px;
                    height: 31px;
                    border-radius: 31px;
                    background: rgba(0, 0, 0, 0.1);
                    position: relative;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .switch.active { background: #34C759; }
                .switch::after {
                    content: '';
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 27px;
                    height: 27px;
                    border-radius: 50%;
                    background: #fff;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    transition: transform 0.3s ease;
                }
                .switch.active::after { transform: translateX(20px); }
                
                /* 复选框 */
                .checkbox {
                    width: 22px;
                    height: 22px;
                    border-radius: 6px;
                    border: 2px solid rgba(0, 0, 0, 0.2);
                    background: rgba(255, 255, 255, 0.6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .checkbox.checked {
                    background: #007AFF;
                    border-color: #007AFF;
                }
                .checkbox i { color: #fff; font-size: 12px; opacity: 0; transition: opacity 0.2s; }
                .checkbox.checked i { opacity: 1; }
                
                /* 模态框 */
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    animation: fadeIn 0.2s ease;
                }
                .modal-content {
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(40px) saturate(200%);
                    border-radius: 20px;
                    padding: 32px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25);
                    animation: slideUp 0.3s ease;
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                
                /* Toast */
                .toast {
                    position: fixed;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 12px 24px;
                    background: rgba(30, 30, 30, 0.9);
                    backdrop-filter: blur(20px);
                    border-radius: 12px;
                    color: #fff;
                    font-size: 14px;
                    font-weight: 500;
                    z-index: 1001;
                    animation: toastIn 0.3s ease;
                }
                @keyframes toastIn { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }
                
                /* 表格 */
                .data-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                }
                .data-table th {
                    text-align: left;
                    padding: 12px 16px;
                    font-size: 12px;
                    font-weight: 600;
                    color: rgba(0, 0, 0, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
                }
                .data-table td {
                    padding: 16px;
                    font-size: 14px;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                }
                .data-table tr:hover td { background: rgba(0, 0, 0, 0.02); }
                
                /* 进度条 */
                .progress-bar {
                    width: 100%;
                    height: 8px;
                    border-radius: 4px;
                    background: rgba(0, 0, 0, 0.08);
                    overflow: hidden;
                }
                .progress-fill {
                    height: 100%;
                    border-radius: 4px;
                    background: linear-gradient(90deg, #007AFF, #5AC8FA);
                    transition: width 0.3s ease;
                }
                
                /* 骨架屏 */
                .skeleton {
                    background: linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.12) 50%, rgba(0,0,0,0.06) 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    border-radius: 8px;
                }
                @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
                
                /* Badge */
                .badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 10px;
                    border-radius: 999px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .badge-blue { background: rgba(0, 122, 255, 0.12); color: #007AFF; }
                .badge-green { background: rgba(52, 199, 89, 0.12); color: #248A3D; }
                .badge-orange { background: rgba(255, 149, 0, 0.12); color: #C93400; }
                .badge-red { background: rgba(255, 59, 48, 0.12); color: #D70015; }
                
                /* 面包屑 */
                .breadcrumb {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                }
                .breadcrumb-item { color: rgba(0, 0, 0, 0.5); cursor: pointer; }
                .breadcrumb-item:hover { color: #007AFF; }
                .breadcrumb-item.active { color: #1D1D1F; font-weight: 600; cursor: default; }
                .breadcrumb-separator { color: rgba(0, 0, 0, 0.3); }
                
                /* 分页 */
                .pagination {
                    display: flex;
                    gap: 4px;
                }
                .page-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    border: none;
                    background: transparent;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .page-btn:hover { background: rgba(0, 0, 0, 0.05); }
                .page-btn.active { background: #007AFF; color: #fff; }
            `}</style>

            <div style={{
                minHeight: '100vh',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'background 0.3s, color 0.3s',
            }}>
                {/* 背景 - 纯多层渐变，无浮动光晕 */}
                <div style={{ 
                    position: 'fixed', 
                    inset: 0, 
                    background: `
                        radial-gradient(ellipse 120% 60% at 50% -10%, rgba(180,195,230,0.25) 0%, transparent 50%),
                        radial-gradient(ellipse 100% 50% at 0% 50%, rgba(200,215,235,0.15) 0%, transparent 40%),
                        radial-gradient(ellipse 80% 60% at 100% 80%, rgba(235,210,195,0.18) 0%, transparent 45%),
                        linear-gradient(180deg, #FAFBFD 0%, #F5F5F7 50%, #F8F7F5 100%)
                    `,
                    pointerEvents: 'none',
                    zIndex: -1
                }} />

                {/* 顶部导航 */}
                <nav className="glass-card" style={{ 
                    position: 'sticky', top: '16px', margin: '16px', zIndex: 100,
                    padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderRadius: '16px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fab fa-apple" style={{ fontSize: '20px' }}></i>
                        <span style={{ fontSize: '15px', fontWeight: 600 }}>Liquid Glass</span>
                        <span style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)', marginLeft: '4px' }}>Design System</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {sections.slice(0, 8).map(s => (
                            <button
                                key={s.id}
                                className={`nav-link ${activeSection === s.id ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveSection(s.id);
                                    document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' });
                                }}
                            >
                                {s.label}
                            </button>
                        ))}
                        <span style={{ color: 'var(--text-tertiary)', margin: '0 4px' }}>...</span>
                    </div>
                </nav>
                
                {/* 回到顶部按钮 */}
                <button 
                    className={`back-to-top ${showBackToTop ? 'visible' : ''}`}
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    title="回到顶部"
                >
                    <i className="fas fa-arrow-up"></i>
                </button>

                <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px 80px', position: 'relative', zIndex: 1 }}>
                    
                    {/* ==================== 设计理念 ==================== */}
                    <section id="philosophy" style={{ marginBottom: '80px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                            <p className="section-title">Philosophy</p>
                            <h1 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px', color: 'var(--text-primary)' }}>
                                Liquid Glass
                            </h1>
                            <p style={{ fontSize: '21px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                                一种全新的动态材质，让界面如同真实的玻璃一般，透明、流动、富有深度。
                            </p>
                        </div>
                        
                        <div className="glass-card" style={{ padding: '40px', marginBottom: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
                                <div>
                                    <div style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px' }} className="gradient-blue">透明</div>
                                    <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Transparent</p>
                                    <p style={{ fontSize: '15px', color: 'var(--text-tertiary)', marginTop: '12px', lineHeight: 1.6 }}>
                                        让内容透过界面自然呈现，创造层次分明的视觉体验。
                                    </p>
                                </div>
                                <div>
                                    <div style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px' }} className="gradient-purple">流动</div>
                                    <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Flowing</p>
                                    <p style={{ fontSize: '15px', color: 'var(--text-tertiary)', marginTop: '12px', lineHeight: 1.6 }}>
                                        界面随交互自然流动，响应用户的每一次触碰。
                                    </p>
                                </div>
                                <div>
                                    <div style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px' }} className="gradient-green">深度</div>
                                    <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Depth</p>
                                    <p style={{ fontSize: '15px', color: 'var(--text-tertiary)', marginTop: '12px', lineHeight: 1.6 }}>
                                        通过光影和层叠创造真实的空间感知。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ==================== 核心原则 ==================== */}
                    <section id="principles" style={{ marginBottom: '80px' }}>
                        <p className="section-title">Principles</p>
                        <h2 className="section-headline">核心原则</h2>
                        <p className="section-body" style={{ maxWidth: '600px', marginBottom: '32px' }}>
                            Liquid Glass 设计系统遵循三个核心原则，确保界面既美观又实用。
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            {[
                                { icon: 'fa-eye', title: 'Clarity', subtitle: '清晰', color: '#007AFF', desc: '内容优先，确保信息清晰可读。玻璃材质增强而非干扰内容展示。' },
                                { icon: 'fa-hand-paper', title: 'Deference', subtitle: '顺从', color: '#34C759', desc: '界面服务于内容，半透明材质让背景与前景自然融合。' },
                                { icon: 'fa-layer-group', title: 'Depth', subtitle: '层次', color: '#AF52DE', desc: '通过模糊、阴影和层级构建空间感，引导用户视觉焦点。' },
                            ].map(p => (
                                <div key={p.title} className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
                                    <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: `${p.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                        <i className={`fas ${p.icon}`} style={{ fontSize: '24px', color: p.color }}></i>
                                    </div>
                                    <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{p.title}</h3>
                                    <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.5)', marginBottom: '12px' }}>{p.subtitle}</p>
                                    <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.6)', lineHeight: 1.6 }}>{p.desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ==================== 色彩系统 ==================== */}
                    <section id="colors" style={{ marginBottom: '80px' }}>
                        <p className="section-title">Colors</p>
                        <h2 className="section-headline">色彩系统</h2>
                        <p className="section-body" style={{ maxWidth: '600px', marginBottom: '32px' }}>
                            系统色彩经过精心调校，在玻璃材质上保持最佳可读性和视觉效果。
                        </p>
                        
                        <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', color: 'rgba(0,0,0,0.5)' }}>System Colors</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' }}>
                                {[
                                    { name: 'Blue', hex: '#007AFF', desc: '主操作' },
                                    { name: 'Green', hex: '#34C759', desc: '成功' },
                                    { name: 'Orange', hex: '#FF9500', desc: '警告' },
                                    { name: 'Red', hex: '#FF3B30', desc: '错误' },
                                    { name: 'Purple', hex: '#AF52DE', desc: '强调' },
                                    { name: 'Teal', hex: '#5AC8FA', desc: '信息' },
                                ].map(c => (
                                    <div key={c.name}>
                                        <div className="color-swatch" style={{ background: c.hex, marginBottom: '12px' }} />
                                        <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{c.name}</p>
                                        <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>{c.hex}</p>
                                        <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', marginTop: '4px' }}>{c.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="glass-card" style={{ padding: '32px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', color: 'rgba(0,0,0,0.5)' }}>Grayscale</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' }}>
                                {[
                                    { name: 'Label', hex: '#1D1D1F' },
                                    { name: 'Secondary', hex: '#86868B' },
                                    { name: 'Tertiary', hex: '#AEAEB2' },
                                    { name: 'Quaternary', hex: '#D1D1D6' },
                                    { name: 'Separator', hex: '#E5E5EA' },
                                    { name: 'Background', hex: '#F2F2F7' },
                                ].map(c => (
                                    <div key={c.name}>
                                        <div className="color-swatch" style={{ background: c.hex, marginBottom: '12px' }} />
                                        <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{c.name}</p>
                                        <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>{c.hex}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ==================== 排版系统 ==================== */}
                    <section id="typography" style={{ marginBottom: '80px' }}>
                        <p className="section-title">Typography</p>
                        <h2 className="section-headline">排版系统</h2>
                        <p className="section-body" style={{ maxWidth: '600px', marginBottom: '32px' }}>
                            使用 SF Pro 字体家族，确保在各种尺寸下的清晰度和可读性。
                        </p>
                        
                        <div className="glass-card" style={{ padding: '32px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {[
                                    { name: 'Large Title', size: '34px', weight: 700, sample: '大标题 Large Title' },
                                    { name: 'Title 1', size: '28px', weight: 700, sample: '标题一 Title 1' },
                                    { name: 'Title 2', size: '22px', weight: 700, sample: '标题二 Title 2' },
                                    { name: 'Title 3', size: '20px', weight: 600, sample: '标题三 Title 3' },
                                    { name: 'Headline', size: '17px', weight: 600, sample: '标题 Headline' },
                                    { name: 'Body', size: '17px', weight: 400, sample: '正文 Body - 这是一段示例正文，用于展示排版效果。' },
                                    { name: 'Callout', size: '16px', weight: 400, sample: '说明 Callout' },
                                    { name: 'Footnote', size: '13px', weight: 400, sample: '脚注 Footnote' },
                                    { name: 'Caption', size: '12px', weight: 400, sample: '标签 Caption' },
                                ].map(t => (
                                    <div key={t.name} style={{ display: 'flex', alignItems: 'baseline', gap: '24px' }}>
                                        <div style={{ width: '120px', flexShrink: 0 }}>
                                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(0,0,0,0.5)' }}>{t.name}</p>
                                            <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)' }}>{t.size} / {t.weight}</p>
                                        </div>
                                        <p style={{ fontSize: t.size, fontWeight: t.weight, color: '#1D1D1F' }}>{t.sample}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ==================== 间距系统 ==================== */}
                    <section id="spacing" style={{ marginBottom: '80px' }}>
                        <p className="section-title">Spacing</p>
                        <h2 className="section-headline">间距系统</h2>
                        <p className="section-body" style={{ maxWidth: '600px', marginBottom: '32px' }}>
                            基于 8px 网格系统，确保界面元素的一致性和节奏感。
                        </p>
                        
                        <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Spacing Scale</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '16px' }}>
                                {[
                                    { name: '2xs', value: '4px', token: '--space-1' },
                                    { name: 'xs', value: '8px', token: '--space-2' },
                                    { name: 'sm', value: '12px', token: '--space-3' },
                                    { name: 'md', value: '16px', token: '--space-4' },
                                    { name: 'lg', value: '24px', token: '--space-6' },
                                    { name: 'xl', value: '32px', token: '--space-8' },
                                    { name: '2xl', value: '48px', token: '--space-12' },
                                    { name: '3xl', value: '64px', token: '--space-16' },
                                ].map(s => (
                                    <div key={s.name} style={{ textAlign: 'center' }}>
                                        <div style={{ height: s.value, background: 'linear-gradient(135deg, #007AFF, #5AC8FA)', borderRadius: '4px', marginBottom: '12px' }} />
                                        <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{s.name}</p>
                                        <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>{s.value}</p>
                                        <code style={{ fontSize: '10px', color: '#AF52DE' }}>{s.token}</code>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', color: 'rgba(0,0,0,0.5)' }}>容器内边距</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {[
                                        { name: 'Compact', padding: '12px', usage: '小型卡片、标签' },
                                        { name: 'Default', padding: '16px', usage: '标准卡片、列表项' },
                                        { name: 'Comfortable', padding: '24px', usage: '大型卡片、模态框' },
                                        { name: 'Spacious', padding: '32px', usage: '页面区域、Hero' },
                                    ].map(p => (
                                        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ width: '80px', padding: p.padding, background: 'rgba(0,122,255,0.1)', borderRadius: '8px', border: '1px dashed rgba(0,122,255,0.3)' }}>
                                                <div style={{ background: '#007AFF', height: '20px', borderRadius: '4px' }} />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '14px', fontWeight: 600 }}>{p.name}</p>
                                                <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>{p.padding} · {p.usage}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', color: 'rgba(0,0,0,0.5)' }}>元素间距 (Gap)</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {[
                                        { name: 'Tight', gap: '8px', usage: '图标与文字、内联元素' },
                                        { name: 'Default', gap: '16px', usage: '列表项、表单字段' },
                                        { name: 'Loose', gap: '24px', usage: '卡片网格、章节' },
                                        { name: 'Section', gap: '48px', usage: '页面区块' },
                                    ].map(g => (
                                        <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ display: 'flex', gap: g.gap }}>
                                                {[1,2,3].map(i => (
                                                    <div key={i} style={{ width: '24px', height: '24px', background: '#007AFF', borderRadius: '6px' }} />
                                                ))}
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '14px', fontWeight: 600 }}>{g.name}</p>
                                                <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>{g.gap} · {g.usage}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ==================== 布局系统 ==================== */}
                    <section id="layout" style={{ marginBottom: '80px' }}>
                        <p className="section-title">Layout</p>
                        <h2 className="section-headline">布局系统</h2>
                        <p className="section-body" style={{ maxWidth: '600px', marginBottom: '32px' }}>
                            响应式网格系统，适配从手机到桌面的各种设备。
                        </p>
                        
                        <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', color: 'rgba(0,0,0,0.5)' }}>Breakpoints 断点</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                                {[
                                    { name: 'Mobile', breakpoint: '< 640px', cols: 4, icon: 'fa-mobile-alt' },
                                    { name: 'Tablet', breakpoint: '≥ 640px', cols: 8, icon: 'fa-tablet-alt' },
                                    { name: 'Laptop', breakpoint: '≥ 1024px', cols: 12, icon: 'fa-laptop' },
                                    { name: 'Desktop', breakpoint: '≥ 1280px', cols: 12, icon: 'fa-desktop' },
                                    { name: 'Wide', breakpoint: '≥ 1536px', cols: 12, icon: 'fa-tv' },
                                ].map(b => (
                                    <div key={b.name} style={{ textAlign: 'center', padding: '20px', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
                                        <i className={`fas ${b.icon}`} style={{ fontSize: '24px', color: '#007AFF', marginBottom: '12px', display: 'block' }}></i>
                                        <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{b.name}</p>
                                        <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>{b.breakpoint}</p>
                                        <p style={{ fontSize: '11px', color: '#007AFF', marginTop: '4px' }}>{b.cols} columns</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', color: 'rgba(0,0,0,0.5)' }}>Grid 网格</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '4px', marginBottom: '16px' }}>
                                    {Array.from({length: 12}).map((_, i) => (
                                        <div key={i} style={{ height: '40px', background: 'rgba(0,122,255,0.15)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#007AFF', fontWeight: 600 }}>{i+1}</div>
                                    ))}
                                </div>
                                <div className="code-block">
                                    <code>{`display: grid;
grid-template-columns: repeat(12, 1fr);
gap: 16px;`}</code>
                                </div>
                            </div>
                            
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', color: 'rgba(0,0,0,0.5)' }}>Container 容器</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {[
                                        { name: 'sm', width: '640px', usage: '窄内容' },
                                        { name: 'md', width: '768px', usage: '文章' },
                                        { name: 'lg', width: '1024px', usage: '应用界面' },
                                        { name: 'xl', width: '1280px', usage: '仪表盘' },
                                        { name: '2xl', width: '1536px', usage: '全宽布局' },
                                    ].map(c => (
                                        <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <code style={{ width: '40px', fontSize: '13px', color: '#AF52DE' }}>{c.name}</code>
                                            <div style={{ flex: 1, height: '8px', background: 'rgba(0,0,0,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ width: `${parseInt(c.width)/1536*100}%`, height: '100%', background: '#007AFF', borderRadius: '4px' }} />
                                            </div>
                                            <span style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)', width: '80px' }}>{c.width}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ==================== 层级系统 ==================== */}
                    <section id="elevation" style={{ marginBottom: '80px' }}>
                        <p className="section-title">Elevation</p>
                        <h2 className="section-headline">层级系统</h2>
                        <p className="section-body" style={{ maxWidth: '600px', marginBottom: '32px' }}>
                            通过阴影和 z-index 构建清晰的层级关系，引导用户视觉焦点。
                        </p>
                        
                        <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Shadow Scale 阴影层级</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '24px' }}>
                                {[
                                    { level: 0, name: 'Flat', shadow: 'none', usage: '内嵌元素' },
                                    { level: 1, name: 'Raised', shadow: '0 1px 3px rgba(0,0,0,0.08)', usage: '卡片、按钮' },
                                    { level: 2, name: 'Float', shadow: '0 4px 12px rgba(0,0,0,0.1)', usage: '悬浮卡片' },
                                    { level: 3, name: 'Overlay', shadow: '0 8px 24px rgba(0,0,0,0.15)', usage: '下拉菜单' },
                                    { level: 4, name: 'Modal', shadow: '0 24px 80px rgba(0,0,0,0.25)', usage: '模态框' },
                                ].map(s => (
                                    <div key={s.level}>
                                        <div style={{ 
                                            height: '80px', 
                                            background: 'rgba(255,255,255,0.8)', 
                                            borderRadius: '16px', 
                                            boxShadow: s.shadow,
                                            border: s.level === 0 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                                            marginBottom: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '24px',
                                            fontWeight: 700,
                                            color: '#007AFF'
                                        }}>{s.level}</div>
                                        <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{s.name}</p>
                                        <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.5)' }}>{s.usage}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="glass-card" style={{ padding: '32px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Z-Index Scale</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[
                                    { zIndex: 'auto', name: 'Base', desc: '默认内容层' },
                                    { zIndex: '10', name: 'Dropdown', desc: '下拉菜单、Tooltip' },
                                    { zIndex: '20', name: 'Sticky', desc: '粘性导航栏' },
                                    { zIndex: '30', name: 'Fixed', desc: '固定元素' },
                                    { zIndex: '40', name: 'Overlay', desc: '遮罩层' },
                                    { zIndex: '50', name: 'Modal', desc: '模态框' },
                                    { zIndex: '60', name: 'Toast', desc: '通知提示' },
                                ].map((z, i) => (
                                    <div key={z.zIndex} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: `rgba(0,122,255,${0.03 + i * 0.02})`, borderRadius: '8px' }}>
                                        <code style={{ width: '60px', fontSize: '14px', fontWeight: 600, color: '#AF52DE' }}>{z.zIndex}</code>
                                        <span style={{ width: '100px', fontSize: '14px', fontWeight: 600 }}>{z.name}</span>
                                        <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)' }}>{z.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ==================== 动效系统 ==================== */}
                    <section id="motion" style={{ marginBottom: '80px' }}>
                        <p className="section-title">Motion</p>
                        <h2 className="section-headline">动效系统</h2>
                        <p className="section-body" style={{ maxWidth: '600px', marginBottom: '32px' }}>
                            流畅自然的动效让界面充满生命力，同时保持功能性和可访问性。
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', color: 'rgba(0,0,0,0.5)' }}>Duration 时长</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {[
                                        { name: 'Instant', duration: '0ms', usage: '无动画' },
                                        { name: 'Fast', duration: '100ms', usage: '微交互、Hover' },
                                        { name: 'Normal', duration: '200ms', usage: '按钮、切换' },
                                        { name: 'Slow', duration: '300ms', usage: '展开、收起' },
                                        { name: 'Slower', duration: '400ms', usage: '模态框、页面转场' },
                                        { name: 'Slowest', duration: '500ms', usage: '复杂动画' },
                                    ].map(d => (
                                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ width: '80px', height: '8px', background: 'rgba(0,0,0,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ width: `${parseInt(d.duration)/5}%`, height: '100%', background: '#007AFF', borderRadius: '4px' }} />
                                            </div>
                                            <span style={{ width: '70px', fontSize: '13px', fontWeight: 600 }}>{d.name}</span>
                                            <code style={{ fontSize: '12px', color: '#AF52DE' }}>{d.duration}</code>
                                            <span style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>{d.usage}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', color: 'rgba(0,0,0,0.5)' }}>Easing 缓动函数</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {[
                                        { name: 'Linear', curve: 'linear', usage: '进度条' },
                                        { name: 'Ease Out', curve: 'cubic-bezier(0, 0, 0.2, 1)', usage: '进入动画' },
                                        { name: 'Ease In', curve: 'cubic-bezier(0.4, 0, 1, 1)', usage: '退出动画' },
                                        { name: 'Ease In Out', curve: 'cubic-bezier(0.4, 0, 0.2, 1)', usage: '状态切换' },
                                        { name: 'Spring', curve: 'cubic-bezier(0.34, 1.56, 0.64, 1)', usage: '弹性效果' },
                                    ].map(e => (
                                        <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <span style={{ width: '90px', fontSize: '13px', fontWeight: 600 }}>{e.name}</span>
                                            <code style={{ flex: 1, fontSize: '10px', color: '#AF52DE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.curve}</code>
                                            <span style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)', width: '80px' }}>{e.usage}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="glass-card" style={{ padding: '32px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', color: 'rgba(0,0,0,0.5)' }}>Animation Patterns 动画模式</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                {[
                                    { name: 'Fade', keyframes: 'opacity: 0 → 1', icon: 'fa-eye' },
                                    { name: 'Scale', keyframes: 'scale: 0.95 → 1', icon: 'fa-expand-alt' },
                                    { name: 'Slide', keyframes: 'translateY: 10px → 0', icon: 'fa-arrow-up' },
                                    { name: 'Blur', keyframes: 'blur: 10px → 0', icon: 'fa-circle' },
                                ].map(a => (
                                    <div key={a.name} style={{ padding: '20px', background: 'rgba(0,0,0,0.03)', borderRadius: '12px', textAlign: 'center' }}>
                                        <i className={`fas ${a.icon}`} style={{ fontSize: '24px', color: '#007AFF', marginBottom: '12px', display: 'block' }}></i>
                                        <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{a.name}</p>
                                        <code style={{ fontSize: '10px', color: 'rgba(0,0,0,0.5)' }}>{a.keyframes}</code>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ==================== 材质规范 ==================== */}
                    <section id="materials" style={{ marginBottom: '80px' }}>
                        <p className="section-title">Materials</p>
                        <h2 className="section-headline">材质规范</h2>
                        <p className="section-body" style={{ maxWidth: '600px', marginBottom: '32px' }}>
                            Liquid Glass 由四个关键层叠加而成，创造出独特的玻璃质感。
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>层级结构</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {[
                                        { layer: 'Effect Layer', desc: '模糊扭曲层', css: 'backdrop-filter: blur(20px)' },
                                        { layer: 'Tint Layer', desc: '色调层', css: 'background: rgba(255,255,255,0.25)' },
                                        { layer: 'Shine Layer', desc: '光泽层', css: 'inset box-shadow' },
                                        { layer: 'Content Layer', desc: '内容层', css: 'z-index: 3' },
                                    ].map((l, i) => (
                                        <div key={l.layer} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#007AFF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}>{i + 1}</div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontSize: '14px', fontWeight: 600 }}>{l.layer}</p>
                                                <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>{l.desc}</p>
                                            </div>
                                            <code style={{ fontSize: '11px', color: '#AF52DE' }}>{l.css}</code>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>关键参数</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                    {[
                                        { label: 'Blur Radius', value: '20-40px' },
                                        { label: 'Saturation', value: '180-200%' },
                                        { label: 'Opacity', value: '15-40%' },
                                        { label: 'Border Radius', value: '16-28px' },
                                    ].map(p => (
                                        <div key={p.label} style={{ padding: '16px', background: 'rgba(0,0,0,0.03)', borderRadius: '12px', textAlign: 'center' }}>
                                            <p style={{ fontSize: '24px', fontWeight: 700, color: '#007AFF' }}>{p.value}</p>
                                            <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)', marginTop: '4px' }}>{p.label}</p>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="code-block" style={{ marginTop: '24px' }}>
                                    <pre style={{ margin: 0, fontSize: '13px', lineHeight: 1.6 }}>
{`.glass-card {
  backdrop-filter: blur(20px) saturate(180%);
  background: rgba(255, 255, 255, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
}`}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ==================== 组件库 ==================== */}
                    <section id="components" style={{ marginBottom: '80px' }}>
                        <p className="section-title">Components</p>
                        <h2 className="section-headline">组件库</h2>
                        <p className="section-body" style={{ maxWidth: '600px', marginBottom: '32px' }}>
                            基于 Liquid Glass 材质打造的核心 UI 组件。
                        </p>
                        
                        {/* 按钮 */}
                        <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Buttons 按钮</h3>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <button className="btn btn-primary">Primary 主按钮</button>
                                <button className="btn btn-secondary">Secondary 次按钮</button>
                                <button className="btn btn-glass">Glass 玻璃按钮</button>
                                <button className="btn btn-primary" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>Disabled 禁用</button>
                            </div>
                            <div className="code-block" style={{ marginTop: '24px' }}>
                                <code>{`<button class="btn btn-primary">Primary</button>`}</code>
                            </div>
                        </div>
                        
                        {/* 滑块 */}
                        <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Slider 滑块</h3>
                            <div style={{ maxWidth: '320px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)' }}>Value</span>
                                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{sliderValue}%</span>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <div className="slider-track">
                                        <div className="slider-fill" style={{ width: `${sliderValue}%` }} />
                                        <div className="slider-thumb" style={{ left: `${sliderValue}%` }} />
                                    </div>
                                    <input 
                                        type="range" min="0" max="100" value={sliderValue}
                                        onChange={(e) => setSliderValue(Number(e.target.value))}
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '24px', opacity: 0, cursor: 'pointer' }}
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* 标签栏 */}
                        <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Segmented Control 分段控件</h3>
                            <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', borderRadius: '12px', background: 'rgba(0,0,0,0.06)' }}>
                                {['首页', '发现', '资料库'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: '10px',
                                            border: 'none',
                                            background: activeTab === tab ? 'rgba(255,255,255,0.8)' : 'transparent',
                                            color: '#1D1D1F',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                                        }}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {/* 卡片示例 */}
                        <div className="glass-card" style={{ padding: '32px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Card 卡片</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                                <div className="glass-card" style={{ padding: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '18px', fontWeight: 700 }}>镜头 #1</span>
                                        <span style={{ padding: '4px 12px', borderRadius: '999px', background: 'rgba(52,199,89,0.15)', color: '#248A3D', fontSize: '13px', fontWeight: 600 }}>
                                            <i className="fas fa-check" style={{ marginRight: '4px' }}></i>已完成
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '15px', color: 'rgba(0,0,0,0.6)', lineHeight: 1.6, marginBottom: '16px' }}>
                                        一个女孩站在樱花树下，微风轻拂，花瓣缓缓飘落...
                                    </p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {['中景', '自然光', '暖色调'].map(tag => (
                                            <span key={tag} style={{ padding: '6px 12px', borderRadius: '999px', background: 'rgba(0,0,0,0.05)', fontSize: '13px' }}>{tag}</span>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.5)', lineHeight: 1.8 }}>
                                        卡片是 Liquid Glass 的核心载体，通过层叠的玻璃材质创造深度感。卡片内部元素应保持简洁，让内容透过材质自然呈现。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ==================== 状态系统 ==================== */}
                    <section id="states" style={{ marginBottom: '80px' }}>
                        <p className="section-title">States</p>
                        <h2 className="section-headline">状态系统</h2>
                        <p className="section-body" style={{ maxWidth: '600px', marginBottom: '32px' }}>
                            统一的交互状态样式，确保用户获得一致的反馈体验。
                        </p>
                        
                        <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Interactive States 交互状态</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '24px' }}>
                                {[
                                    { name: 'Default', desc: '默认状态', style: { background: '#007AFF', opacity: 1 } },
                                    { name: 'Hover', desc: '悬停', style: { background: '#007AFF', filter: 'brightness(1.1)' } },
                                    { name: 'Active', desc: '按下', style: { background: '#007AFF', transform: 'scale(0.98)' } },
                                    { name: 'Focus', desc: '聚焦', style: { background: '#007AFF', boxShadow: '0 0 0 4px rgba(0,122,255,0.3)' } },
                                    { name: 'Disabled', desc: '禁用', style: { background: '#007AFF', opacity: 0.4, cursor: 'not-allowed' } },
                                ].map(s => (
                                    <div key={s.name} style={{ textAlign: 'center' }}>
                                        <div style={{ 
                                            height: '56px', 
                                            borderRadius: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#fff',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            marginBottom: '12px',
                                            transition: 'all 0.2s',
                                            ...s.style
                                        }}>Button</div>
                                        <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{s.name}</p>
                                        <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>{s.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', color: 'rgba(0,0,0,0.5)' }}>Validation States 验证状态</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {[
                                        { name: 'Success', color: '#34C759', icon: 'fa-check-circle' },
                                        { name: 'Warning', color: '#FF9500', icon: 'fa-exclamation-triangle' },
                                        { name: 'Error', color: '#FF3B30', icon: 'fa-times-circle' },
                                        { name: 'Info', color: '#5AC8FA', icon: 'fa-info-circle' },
                                    ].map(v => (
                                        <div key={v.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: `${v.color}10`, borderRadius: '12px', border: `1px solid ${v.color}30` }}>
                                            <i className={`fas ${v.icon}`} style={{ fontSize: '18px', color: v.color }}></i>
                                            <div style={{ flex: 1 }}>
                                                <input className="input-field" placeholder={`${v.name} state input`} style={{ borderColor: v.color, background: 'transparent' }} readOnly />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', color: 'rgba(0,0,0,0.5)' }}>Loading States 加载状态</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div>
                                        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', marginBottom: '12px' }}>Button Loading</p>
                                        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <i className="fas fa-spinner fa-spin"></i>
                                            Processing...
                                        </button>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', marginBottom: '12px' }}>Progress Bar</p>
                                        <div className="progress-bar">
                                            <div className="progress-fill" style={{ width: '65%' }} />
                                        </div>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', marginBottom: '12px' }}>Skeleton Loading</p>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '12px' }} />
                                            <div style={{ flex: 1 }}>
                                                <div className="skeleton" style={{ height: '16px', marginBottom: '8px', width: '60%' }} />
                                                <div className="skeleton" style={{ height: '12px', width: '80%' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ==================== 表单组件 ==================== */}
                    <section id="forms" style={{ marginBottom: '80px' }}>
                        <p className="section-title">Forms</p>
                        <h2 className="section-headline">表单组件</h2>
                        <p className="section-body" style={{ maxWidth: '600px', marginBottom: '32px' }}>
                            完整的表单控件集合，支持各种输入场景。
                        </p>
                        
                        <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Input Fields 输入框</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Text Input</label>
                                    <input 
                                        className="input-field" 
                                        placeholder="Enter text..." 
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>With Icon</label>
                                    <div style={{ position: 'relative' }}>
                                        <i className="fas fa-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,0,0,0.35)' }}></i>
                                        <input className="input-field" placeholder="Search..." style={{ paddingLeft: '40px' }} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Disabled</label>
                                    <input className="input-field" placeholder="Disabled input" disabled />
                                </div>
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Textarea</label>
                                    <textarea className="input-field" placeholder="Enter description..." rows={3} style={{ resize: 'none' }} />
                                </div>
                            </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Switches & Checkboxes</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '14px' }}>Enable notifications</span>
                                        <div className={`switch ${switchOn ? 'active' : ''}`} onClick={() => setSwitchOn(!switchOn)} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '14px' }}>Dark mode</span>
                                        <div className="switch" />
                                    </div>
                                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                            <div className={`checkbox ${checkboxChecked ? 'checked' : ''}`} onClick={() => setCheckboxChecked(!checkboxChecked)}>
                                                <i className="fas fa-check"></i>
                                            </div>
                                            <span style={{ fontSize: '14px' }}>I agree to the terms</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div className="checkbox checked"><i className="fas fa-check"></i></div>
                                            <span style={{ fontSize: '14px' }}>Subscribe to newsletter</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Radio Buttons & Select</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                                    {['option1', 'option2', 'option3'].map((opt, i) => (
                                        <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div 
                                                onClick={() => setRadioValue(opt)}
                                                style={{ 
                                                    width: '20px', height: '20px', borderRadius: '50%', 
                                                    border: `2px solid ${radioValue === opt ? '#007AFF' : 'rgba(0,0,0,0.2)'}`,
                                                    background: radioValue === opt ? '#007AFF' : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    cursor: 'pointer', transition: 'all 0.2s'
                                                }}
                                            >
                                                {radioValue === opt && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                                            </div>
                                            <span style={{ fontSize: '14px' }}>Option {i + 1}</span>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Select</label>
                                    <select className="input-field" style={{ cursor: 'pointer' }}>
                                        <option>Choose an option</option>
                                        <option>Option 1</option>
                                        <option>Option 2</option>
                                        <option>Option 3</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ==================== 反馈组件 ==================== */}
                    <section id="feedback" style={{ marginBottom: '80px' }}>
                        <p className="section-title">Feedback</p>
                        <h2 className="section-headline">反馈组件</h2>
                        <p className="section-body" style={{ maxWidth: '600px', marginBottom: '32px' }}>
                            及时的用户反馈组件，提升交互体验。
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Badges 徽章</h3>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                    <span className="badge badge-blue"><i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>Info</span>
                                    <span className="badge badge-green"><i className="fas fa-check" style={{ marginRight: '6px' }}></i>Success</span>
                                    <span className="badge badge-orange"><i className="fas fa-exclamation" style={{ marginRight: '6px' }}></i>Warning</span>
                                    <span className="badge badge-red"><i className="fas fa-times" style={{ marginRight: '6px' }}></i>Error</span>
                                </div>
                            </div>
                            
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Toast & Modal</h3>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button className="btn btn-secondary" onClick={() => { setToastVisible(true); setTimeout(() => setToastVisible(false), 2000); }}>
                                        Show Toast
                                    </button>
                                    <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                                        Open Modal
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="glass-card" style={{ padding: '32px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Data Table 数据表格</h3>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Status</th>
                                        <th>Progress</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { name: 'Project Alpha', status: 'Active', progress: 75 },
                                        { name: 'Project Beta', status: 'Pending', progress: 45 },
                                        { name: 'Project Gamma', status: 'Complete', progress: 100 },
                                    ].map(row => (
                                        <tr key={row.name}>
                                            <td style={{ fontWeight: 500 }}>{row.name}</td>
                                            <td>
                                                <span className={`badge ${row.status === 'Active' ? 'badge-blue' : row.status === 'Pending' ? 'badge-orange' : 'badge-green'}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div className="progress-bar" style={{ width: '100px' }}>
                                                        <div className="progress-fill" style={{ width: `${row.progress}%` }} />
                                                    </div>
                                                    <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)' }}>{row.progress}%</span>
                                                </div>
                                            </td>
                                            <td>
                                                <button className="btn btn-glass" style={{ padding: '6px 12px', fontSize: '13px' }}>View</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* ==================== 导航组件 ==================== */}
                    <section id="navigation" style={{ marginBottom: '80px' }}>
                        <p className="section-title">Navigation</p>
                        <h2 className="section-headline">导航组件</h2>
                        <p className="section-body" style={{ maxWidth: '600px', marginBottom: '32px' }}>
                            帮助用户在应用中导航的组件集合。
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Breadcrumb 面包屑</h3>
                                <div className="breadcrumb">
                                    <span className="breadcrumb-item">Home</span>
                                    <span className="breadcrumb-separator">/</span>
                                    <span className="breadcrumb-item">Projects</span>
                                    <span className="breadcrumb-separator">/</span>
                                    <span className="breadcrumb-item active">Design System</span>
                                </div>
                            </div>
                            
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Pagination 分页</h3>
                                <div className="pagination">
                                    <button className="page-btn"><i className="fas fa-chevron-left"></i></button>
                                    <button className="page-btn">1</button>
                                    <button className="page-btn active">2</button>
                                    <button className="page-btn">3</button>
                                    <button className="page-btn">...</button>
                                    <button className="page-btn">10</button>
                                    <button className="page-btn"><i className="fas fa-chevron-right"></i></button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="glass-card" style={{ padding: '32px', marginTop: '24px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', color: 'rgba(0,0,0,0.5)' }}>Tab Bar 标签栏</h3>
                            <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: '16px', padding: '12px', display: 'flex', justifyContent: 'space-around' }}>
                                {[
                                    { icon: 'fa-home', label: 'Home', active: true },
                                    { icon: 'fa-search', label: 'Search', active: false },
                                    { icon: 'fa-plus-circle', label: 'Create', active: false },
                                    { icon: 'fa-bell', label: 'Alerts', active: false },
                                    { icon: 'fa-user', label: 'Profile', active: false },
                                ].map(tab => (
                                    <div key={tab.label} style={{ 
                                        textAlign: 'center', 
                                        padding: '8px 16px', 
                                        borderRadius: '12px',
                                        background: tab.active ? 'rgba(255,255,255,0.8)' : 'transparent',
                                        boxShadow: tab.active ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}>
                                        <i className={`fas ${tab.icon}`} style={{ 
                                            fontSize: '20px', 
                                            color: tab.active ? '#007AFF' : 'rgba(0,0,0,0.4)',
                                            marginBottom: '4px',
                                            display: 'block'
                                        }}></i>
                                        <span style={{ 
                                            fontSize: '11px', 
                                            fontWeight: 600,
                                            color: tab.active ? '#007AFF' : 'rgba(0,0,0,0.5)'
                                        }}>{tab.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ==================== 使用指南 ==================== */}
                    <section id="usage" style={{ marginBottom: '40px' }}>
                        <p className="section-title">Usage Guidelines</p>
                        <h2 className="section-headline">使用指南</h2>
                        <p className="section-body" style={{ maxWidth: '600px', marginBottom: '32px' }}>
                            遵循以下原则，确保 Liquid Glass 效果的最佳呈现。
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#34C759', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fas fa-check"></i>
                                    </div>
                                    <h3 style={{ fontSize: '18px', fontWeight: 700 }}>推荐做法</h3>
                                </div>
                                <ul style={{ fontSize: '14px', color: 'rgba(0,0,0,0.7)', lineHeight: 2, paddingLeft: '20px' }}>
                                    <li>使用彩色渐变背景增强玻璃折射效果</li>
                                    <li>保持足够对比度确保文字可读</li>
                                    <li>层叠使用时控制层级数量 (≤3层)</li>
                                    <li>为动效设置合理的 duration (200-400ms)</li>
                                    <li>使用 saturate() 增强背景色彩活力</li>
                                </ul>
                            </div>
                            
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FF3B30', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fas fa-times"></i>
                                    </div>
                                    <h3 style={{ fontSize: '18px', fontWeight: 700 }}>避免做法</h3>
                                </div>
                                <ul style={{ fontSize: '14px', color: 'rgba(0,0,0,0.7)', lineHeight: 2, paddingLeft: '20px' }}>
                                    <li>在纯色/暗色背景上使用 (效果不明显)</li>
                                    <li>过度堆叠玻璃层导致内容模糊</li>
                                    <li>使用过大的 blur 值 (&gt;60px)</li>
                                    <li>忽略无障碍访问需求</li>
                                    <li>在性能敏感场景过度使用</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div className="glass-card" style={{ padding: '32px', marginTop: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>无障碍考虑</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                                <div style={{ padding: '20px', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
                                    <i className="fas fa-low-vision" style={{ fontSize: '20px', color: '#007AFF', marginBottom: '12px', display: 'block' }}></i>
                                    <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Reduce Transparency</p>
                                    <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>降低透明度时自动切换为不透明背景</p>
                                </div>
                                <div style={{ padding: '20px', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
                                    <i className="fas fa-pause-circle" style={{ fontSize: '20px', color: '#34C759', marginBottom: '12px', display: 'block' }}></i>
                                    <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Reduce Motion</p>
                                    <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>减少动效时禁用过渡动画</p>
                                </div>
                                <div style={{ padding: '20px', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
                                    <i className="fas fa-adjust" style={{ fontSize: '20px', color: '#AF52DE', marginBottom: '12px', display: 'block' }}></i>
                                    <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>High Contrast</p>
                                    <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>高对比模式下增强边框和文字对比度</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Footer */}
                    <footer style={{ textAlign: 'center', paddingTop: '40px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                            <i className="fab fa-apple" style={{ fontSize: '20px' }}></i>
                            <span style={{ fontSize: '15px', fontWeight: 600 }}>Liquid Glass Design System</span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.4)' }}>
                            iOS 26 · iPadOS 26 · macOS 26 · visionOS 3
                        </p>
                        <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.3)', marginTop: '8px' }}>
                            Human Interface Guidelines · Version 1.0
                        </p>
                    </footer>
                </main>
            </div>
            
            {/* Toast 通知 */}
            {toastVisible && (
                <div className="toast">
                    <i className="fas fa-check-circle" style={{ marginRight: '8px', color: '#34C759' }}></i>
                    操作成功完成！
                </div>
            )}
            
            {/* Modal 模态框 */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{ 
                                width: '56px', height: '56px', borderRadius: '16px', 
                                background: 'linear-gradient(135deg, #007AFF, #5AC8FA)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 16px'
                            }}>
                                <i className="fas fa-info" style={{ fontSize: '24px', color: '#fff' }}></i>
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Liquid Glass Modal</h3>
                            <p style={{ fontSize: '15px', color: 'rgba(0,0,0,0.6)', lineHeight: 1.6 }}>
                                这是一个使用 Liquid Glass 材质的模态框示例。背景使用了 blur 和 saturate 滤镜。
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>
                                取消
                            </button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>
                                确认
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
