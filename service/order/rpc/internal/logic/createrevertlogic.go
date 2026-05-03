package logic

import (
	"context"
	"database/sql"

	"mall/service/order/model"
	"mall/service/order/rpc/internal/svc"
	"mall/service/order/rpc/pb/order"

	"github.com/dtm-labs/dtmgrpc"
	"github.com/zeromicro/go-zero/core/logx"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type CreateRevertLogic struct {
	ctx    context.Context
	svcCtx *svc.ServiceContext
	logx.Logger
}

func NewCreateRevertLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CreateRevertLogic {
	return &CreateRevertLogic{
		ctx:    ctx,
		svcCtx: svcCtx,
		Logger: logx.WithContext(ctx),
	}
}

func (l *CreateRevertLogic) CreateRevert(in *order.CreateRequest) (*order.CreateResponse, error) {
	db, err := sqlx.NewMysql(l.svcCtx.Config.Mysql.DataSource).RawDB()
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	barrier, err := dtmgrpc.BarrierFromGrpc(l.ctx)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	if err := barrier.CallWithDB(db, func(tx *sql.Tx) error {
		resOrder, err := l.svcCtx.OrderModel.FindOneByUidPidAmountStatus(in.Uid, in.Pid, in.Amount, in.Status)
		if err != nil {
			if err == model.ErrNotFound {
				return nil
			}
			return err
		}

		resOrder.Status = 9
		return l.svcCtx.OrderModel.TxUpdate(tx, resOrder)
	}); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &order.CreateResponse{}, nil
}
