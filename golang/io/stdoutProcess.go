func stdoutProcess(input chan string) {
  for {
    str, _ := <- input
    fmt.Println(str)
  }
}
