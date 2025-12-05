'use client';

export default function ColorDemoPage() {
    // Apple Human Interface Guidelines 官方配色
    const appleSystemColors = [
        { name: 'Blue', hex: '#007AFF', desc: '链接/按钮' },
        { name: 'Green', hex: '#34C759', desc: '成功/确认' },
        { name: 'Indigo', hex: '#5856D6', desc: '强调' },
        { name: 'Orange', hex: '#FF9500', desc: '警告' },
        { name: 'Pink', hex: '#FF2D55', desc: '爱心/收藏' },
        { name: 'Purple', hex: '#AF52DE', desc: '创意' },
        { name: 'Red', hex: '#FF3B30', desc: '错误/删除' },
        { name: 'Teal', hex: '#5AC8FA', desc: '信息' },
        { name: 'Yellow', hex: '#FFCC00', desc: '提醒' },
    ];

    const appleGrays = [
        { name: 'Label', hex: '#000000', desc: '主文本' },
        { name: 'Secondary', hex: '#3C3C43', opacity: 0.6, desc: '次文本' },
        { name: 'Tertiary', hex: '#3C3C43', opacity: 0.3, desc: '占位符' },
        { name: 'Quaternary', hex: '#3C3C43', opacity: 0.18, desc: '分隔线' },
        { name: 'systemGray', hex: '#8E8E93', desc: '图标' },
        { name: 'systemGray2', hex: '#AEAEB2', desc: '次级' },
        { name: 'systemGray3', hex: '#C7C7CC', desc: '边框' },
        { name: 'systemGray4', hex: '#D1D1D6', desc: '分隔' },
        { name: 'systemGray5', hex: '#E5E5EA', desc: '背景' },
        { name: 'systemGray6', hex: '#F2F2F7', desc: '组背景' },
    ];

    const appleBackgrounds = [
        { name: 'Primary', hex: '#FFFFFF', desc: '主背景' },
        { name: 'Secondary', hex: '#F2F2F7', desc: '次背景' },
        { name: 'Tertiary', hex: '#FFFFFF', desc: '三级背景' },
        { name: 'Grouped', hex: '#F2F2F7', desc: '分组背景' },
    ];

    const colors = [
        { name: '页面背景', hex: '#f5f5f7', desc: 'Apple 浅灰' },
        { name: '卡片背景', hex: '#ffffff', desc: '纯白' },
        { name: '主文本', hex: '#1d1d1f', desc: '近黑' },
        { name: '次文本', hex: '#86868b', desc: '中灰' },
        { name: '弱文本', hex: '#a1a1aa', desc: '浅灰' },
        { name: '边框', hex: 'rgba(0,0,0,0.08)', desc: '透明黑' },
        { name: '强调色', hex: '#0071e3', desc: 'Apple Blue' },
        { name: '成功', hex: '#22c55e', desc: '绿色' },
        { name: '错误', hex: '#ef4444', desc: '红色' },
        { name: '警告', hex: '#f59e0b', desc: '橙色' },
    ];

    return (
        <div style={{ 
            minHeight: '100vh', 
            backgroundColor: '#F2F2F7', 
            padding: '48px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif'
        }}>
            <h1 style={{ 
                fontSize: '34px', 
                fontWeight: 700, 
                color: '#000000',
                marginBottom: '8px',
                letterSpacing: '-0.4px'
            }}>
                Apple Human Interface Guidelines
            </h1>
            <p style={{ color: '#8E8E93', marginBottom: '48px', fontSize: '17px' }}>
                iOS / macOS 官方配色规范
            </p>

            {/* System Colors */}
            <h2 style={{ fontSize: '22px', fontWeight: 600, color: '#000000', marginBottom: '16px' }}>
                System Colors (系统色)
            </h2>
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(9, 1fr)', 
                gap: '12px',
                marginBottom: '48px'
            }}>
                {appleSystemColors.map((c) => (
                    <div key={c.name} style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        padding: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                    }}>
                        <div style={{
                            width: '100%',
                            height: '60px',
                            backgroundColor: c.hex,
                            borderRadius: '8px',
                            marginBottom: '8px'
                        }} />
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#000000' }}>
                            {c.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#8E8E93', marginTop: '2px' }}>
                            {c.hex}
                        </div>
                        <div style={{ fontSize: '10px', color: '#AEAEB2', marginTop: '2px' }}>
                            {c.desc}
                        </div>
                    </div>
                ))}
            </div>

            {/* Gray Scale */}
            <h2 style={{ fontSize: '22px', fontWeight: 600, color: '#000000', marginBottom: '16px' }}>
                Gray Scale (灰度)
            </h2>
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(10, 1fr)', 
                gap: '12px',
                marginBottom: '48px'
            }}>
                {appleGrays.map((c) => (
                    <div key={c.name} style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        padding: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                    }}>
                        <div style={{
                            width: '100%',
                            height: '60px',
                            backgroundColor: c.opacity ? `rgba(60,60,67,${c.opacity})` : c.hex,
                            borderRadius: '8px',
                            marginBottom: '8px',
                            border: c.hex === '#000000' ? 'none' : '1px solid rgba(0,0,0,0.04)'
                        }} />
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#000000' }}>
                            {c.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#8E8E93', marginTop: '2px' }}>
                            {c.opacity ? `${c.hex} @ ${c.opacity * 100}%` : c.hex}
                        </div>
                        <div style={{ fontSize: '9px', color: '#AEAEB2', marginTop: '2px' }}>
                            {c.desc}
                        </div>
                    </div>
                ))}
            </div>

            {/* Backgrounds */}
            <h2 style={{ fontSize: '22px', fontWeight: 600, color: '#000000', marginBottom: '16px' }}>
                Backgrounds (背景)
            </h2>
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)', 
                gap: '12px',
                marginBottom: '48px'
            }}>
                {appleBackgrounds.map((c) => (
                    <div key={c.name} style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        padding: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                    }}>
                        <div style={{
                            width: '100%',
                            height: '60px',
                            backgroundColor: c.hex,
                            borderRadius: '8px',
                            marginBottom: '8px',
                            border: '1px solid rgba(0,0,0,0.08)'
                        }} />
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#000000' }}>
                            {c.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#8E8E93', marginTop: '2px' }}>
                            {c.hex}
                        </div>
                        <div style={{ fontSize: '10px', color: '#AEAEB2', marginTop: '2px' }}>
                            {c.desc}
                        </div>
                    </div>
                ))}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #C7C7CC', margin: '48px 0' }} />

            {/* 当前项目推荐 */}
            <h2 style={{ fontSize: '22px', fontWeight: 600, color: '#000000', marginBottom: '8px' }}>
                推荐精简方案 (10 种)
            </h2>
            <p style={{ color: '#8E8E93', marginBottom: '16px', fontSize: '15px' }}>
                基于 Apple HIG，适合本项目使用
            </p>
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(5, 1fr)', 
                gap: '12px',
                marginBottom: '48px'
            }}>
                {colors.map((c) => (
                    <div key={c.name} style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        padding: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                    }}>
                        <div style={{
                            width: '100%',
                            height: '60px',
                            backgroundColor: c.hex,
                            borderRadius: '8px',
                            border: c.hex === '#ffffff' ? '1px solid rgba(0,0,0,0.08)' : 'none',
                            marginBottom: '8px'
                        }} />
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#000000' }}>
                            {c.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#8E8E93', marginTop: '2px' }}>
                            {c.hex}
                        </div>
                        <div style={{ fontSize: '10px', color: '#AEAEB2', marginTop: '2px' }}>
                            {c.desc}
                        </div>
                    </div>
                ))}
            </div>

            {/* 示例 UI */}
            <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#1d1d1f', marginBottom: '16px' }}>
                示例界面
            </h2>
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                maxWidth: '480px'
            }}>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#1d1d1f', marginBottom: '8px' }}>
                    镜头 #1
                </div>
                <p style={{ fontSize: '14px', color: '#86868b', marginBottom: '16px' }}>
                    一个女孩站在樱花树下，微风吹过...
                </p>
                <div style={{ 
                    display: 'flex', 
                    gap: '8px',
                    marginBottom: '16px'
                }}>
                    <span style={{
                        padding: '4px 12px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        backgroundColor: 'rgba(0,113,227,0.1)',
                        color: '#0071e3'
                    }}>
                        中景
                    </span>
                    <span style={{
                        padding: '4px 12px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        backgroundColor: 'rgba(34,197,94,0.1)',
                        color: '#22c55e'
                    }}>
                        已完成
                    </span>
                </div>
                <div style={{
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    marginBottom: '16px'
                }}>
                    <span style={{ fontSize: '12px', color: '#f59e0b' }}>
                        ⚠️ 警告：提示词过长，建议精简
                    </span>
                </div>
                <div style={{
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    marginBottom: '16px'
                }}>
                    <span style={{ fontSize: '12px', color: '#ef4444' }}>
                        ❌ 错误：图片生成失败
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={{
                        padding: '10px 20px',
                        borderRadius: '12px',
                        border: 'none',
                        backgroundColor: '#0071e3',
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer'
                    }}>
                        生成图片
                    </button>
                    <button style={{
                        padding: '10px 20px',
                        borderRadius: '12px',
                        border: '1px solid rgba(0,0,0,0.08)',
                        backgroundColor: '#ffffff',
                        color: '#1d1d1f',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer'
                    }}>
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
}
