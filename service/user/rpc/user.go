package main

import (
	"flag"
	"fmt"

	"mall/service/user/rpc/internal/config"
	"mall/service/user/rpc/internal/server"
	"mall/service/user/rpc/internal/svc"
	"mall/service/user/rpc/pb/user"

	"github.com/zeromicro/go-zero/core/conf"
	"github.com/zeromicro/go-zero/core/service"
	"github.com/zeromicro/go-zero/zrpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

var configFile = flag.String("f", "etc/user.yaml", "the config file")

func main() {
	flag.Parse()

	var c config.Config
	conf.MustLoad(*configFile, &c)
	ctx := svc.NewServiceContext(c)

	s := zrpc.MustNewServer(c.RpcServerConf, func(grpcServer *grpc.Server) {
		user.RegisterUserServer(grpcServer, server.NewUserServer(ctx))

		if c.Mode == service.DevMode || c.Mode == service.TestMode {
			reflection.Register(grpcServer)
		}
	})
	defer s.Stop()

	fmt.Printf("Starting rpc server at %s...\n", c.ListenOn)
	s.Start()
}

// package main

// import (
// 	"flag"
// 	"fmt"

// 	"mall/service/user/rpc/internal/config"
// 	"mall/service/user/rpc/internal/server"
// 	"mall/service/user/rpc/internal/svc"
// 	"mall/service/user/rpc/pb/user"

// 	"github.com/zeromicro/go-zero/core/conf"
// 	"github.com/zeromicro/go-zero/core/service"
// 	"github.com/zeromicro/go-zero/zrpc"
// 	"google.golang.org/grpc"
// 	"google.golang.org/grpc/reflection"
// )

// var configFile = flag.String("f", "etc/user.yaml", "the config file")

// func main() {
// 	flag.Parse()

// 	var c config.Config
// 	conf.MustLoad(*configFile, &c)

// 	// 添加调试信息
// 	fmt.Printf("Loaded config:\n")
// 	fmt.Printf("  ListenOn: %s\n", c.ListenOn)
// 	fmt.Printf("  Etcd Hosts: %v\n", c.Etcd.Hosts)
// 	fmt.Printf("  Etcd Key: %s\n", c.Etcd.Key)
// 	fmt.Printf("  Mode: %s\n", c.Mode)

// 	ctx := svc.NewServiceContext(c)

// 	s := zrpc.MustNewServer(c.RpcServerConf, func(grpcServer *grpc.Server) {
// 		user.RegisterUserServer(grpcServer, server.NewUserServer(ctx))

// 		if c.Mode == service.DevMode || c.Mode == service.TestMode {
// 			reflection.Register(grpcServer)
// 		}
// 	})
// 	defer s.Stop()

// 	fmt.Printf("Starting rpc server at %s...\n", c.ListenOn)
// 	s.Start()
// }
