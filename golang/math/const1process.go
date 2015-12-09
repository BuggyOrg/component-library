func const1process(const1 chan int) {
  for {
    const1 <- 1
  }
}
