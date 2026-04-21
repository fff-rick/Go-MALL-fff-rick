package cryptx

import (
	"fmt"

	"golang.org/x/crypto/scrypt"
)

func PasswordEncrypt(salt, password string) string {
	dk, _ := scrypt.Key([]byte(password), []byte(salt), 32768, 8, 1, 32)
	return fmt.Sprintf("%x", string(dk))

	/*
	 // 用户输入的密码
	    password := []byte("my_strong_password")

	    // 1. 生成一个随机的盐 (Salt)
	    salt := make([]byte, 16)
	    rand.Read(salt)

	    // 2. 使用 Argon2id 算法派生哈希值
	    // 参数: 密码, 盐, 迭代次数, 内存大小(KB), 并行度, 输出密钥长度
	    hash := argon2.IDKey(password, salt, 1, 64*1024, 4, 32)

	    // 存储时，需要将盐和哈希值一并保存
	    fmt.Printf("盐值: %x\n", salt)
	    fmt.Printf("密码哈希: %x\n", hash)
	*/

}
