package server

import (
	"context"
	"encoding/json"
	"strings"
)

// 开测前的强制校验（品牌化 Catty 需求）。
//
// 目的：杜绝「个人静默测试」。一次渗透测试必须有一条能追到人的飞书通知链路——
// 一旦 Agent 越界、造成资产损失或触发告警，至少有人当场收到推送。因此只要
// 没有「启用且填了 Webhook」的飞书渠道，就不允许创建测试任务。
//
// 该校验在服务端执行：前端也会先查一次并给出更友好的提示，但前端可以被绕过，
// 真正的闸门在这里。
const errFeishuRequired = "请先在「系统设置 → 通知推送」配置并启用飞书机器人的 Webhook 地址，再开始测试"

// hasEnabledFeishuChannel 报告是否存在可用的飞书推送渠道：
// 类型为 feishu、未被停用、且 config.webhook 非空。
func (s *Server) hasEnabledFeishuChannel(ctx context.Context) (bool, error) {
	pg := s.m.PG()
	if pg == nil {
		return false, nil
	}
	channels, err := pg.ListNotificationChannels(ctx)
	if err != nil {
		return false, err
	}
	for _, ch := range channels {
		if ch.Kind != "feishu" {
			continue
		}
		if ch.Enabled != nil && !*ch.Enabled {
			continue
		}
		var cfg map[string]any
		if len(ch.Config) > 0 {
			if err := json.Unmarshal(ch.Config, &cfg); err != nil {
				continue
			}
		}
		if hook, _ := cfg["webhook"].(string); strings.TrimSpace(hook) != "" {
			return true, nil
		}
	}
	return false, nil
}
