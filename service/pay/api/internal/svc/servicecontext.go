// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package svc

import (
	"mall/service/order/rpc/orderclient"
	"mall/service/pay/api/internal/config"
	"mall/service/pay/rpc/payclient"
	"mall/service/user/rpc/userclient"

	"github.com/zeromicro/go-zero/zrpc"
)

type ServiceContext struct {
	Config   config.Config
	PayRpc   payclient.Pay
	UserRpc  userclient.User
	OrderRpc orderclient.Order
}

func NewServiceContext(c config.Config) *ServiceContext {
	return &ServiceContext{
		Config: c,
		PayRpc: payclient.NewPay(zrpc.MustNewClient(c.PayRpc)),
	}
}
